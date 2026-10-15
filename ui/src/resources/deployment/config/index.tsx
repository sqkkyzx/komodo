import { usePermissions, useRead, useWrite } from "@/lib/hooks";
import { Config, ConfigItem, ConfigList, ConfigSwitch } from "mogh_ui";
import { Group, Stack, Text } from "@mantine/core";
import { useLocalStorage } from "@mantine/hooks";
import { Types } from "komodo_client";
import ResourceLink from "@/resources/link";
import ResourceSelector from "@/resources/selector";
import { AccountSelectorConfig } from "@/components/config/account-selector";
import { extractRegistryDomain } from "@/lib/utils";
import DeploymentImageConfig from "./image";
import { MonacoEditor } from "mogh_ui";
import DeploymentNetworkSelector from "./network";
import SecretsSearch from "@/components/config/secrets-search";
import DeploymentRestartSelector from "./restart";
import { Link } from "react-router-dom";
import AddExtraArg from "@/components/config/add-extra-arg";
import { InputList } from "mogh_ui";
import { TerminationSignal, TerminationTimeout } from "./termination";
import { ReactNode } from "react";
import { useFullDeployment } from "..";

export default function DeploymentConfig({
  id,
  titleOther,
}: {
  id: string;
  titleOther?: ReactNode;
}) {
  const { canWrite } = usePermissions({ type: "Deployment", id });
  const config = useFullDeployment(id)?.config;
  const builds = useRead("ListBuilds", { limit: 0 }).data;
  const globalDisabled =
    useRead("GetCoreInfo", {}).data?.ui_write_disabled ?? false;
  const swarmsExist = useRead("ListSwarms", {}).data?.length ? true : false;
  const [update, setUpdate] = useLocalStorage<Partial<Types.DeploymentConfig>>({
    key: `deployment-${id}-update-v1`,
    defaultValue: {},
  });
  const { mutateAsync } = useWrite("UpdateDeployment");

  if (!config) return null;

  const network = update.network ?? config.network;
  const hidePorts = network === "host" || network === "none";
  const autoUpdate = update.auto_update ?? config.auto_update ?? false;

  const disabled = globalDisabled || !canWrite;

  const currSwarmId = update.swarm_id ?? config.swarm_id;
  const currServerId = update.server_id ?? config.server_id;

  return (
    <Config
      titleOther={titleOther}
      disabled={disabled}
      original={config}
      update={update}
      setUpdate={setUpdate}
      onSave={() => mutateAsync({ id, config: update })}
      groups={{
        "": [
          {
            label: "集群",
            labelHidden: true,
            hidden: !swarmsExist || !!currServerId,
            fields: {
              swarm_id: (swarm_id, set) => {
                return (
                  <ConfigItem
                    label={
                      swarm_id ? (
                        <Group fz="h3" fw="bold">
                          集群：
                          <ResourceLink
                            type="Swarm"
                            id={swarm_id}
                            fz="h3"
                            iconSize="1.2rem"
                          />
                        </Group>
                      ) : (
                        "选择集群"
                      )
                    }
                    description="选择用于部署的集群。"
                  >
                    <ResourceSelector
                      type="Swarm"
                      selected={swarm_id}
                      onSelect={(swarm_id) => set({ swarm_id, server_id: "" })}
                      disabled={disabled}
                      clearable
                    />
                  </ConfigItem>
                );
              },
            },
          },
          {
            label: "服务器",
            labelHidden: true,
            hidden: swarmsExist && !!currSwarmId,
            fields: {
              server_id: (server_id, set) => {
                return (
                  <ConfigItem
                    label={
                      server_id ? (
                        <Group fz="h3" fw="bold">
                          服务器：
                          <ResourceLink
                            type="Server"
                            id={server_id}
                            fz="h3"
                            iconSize="1.2rem"
                          />
                        </Group>
                      ) : (
                        "选择服务器"
                      )
                    }
                    description="选择用于部署的服务器。"
                  >
                    <ResourceSelector
                      type="Server"
                      selected={server_id}
                      onSelect={(server_id) => set({ server_id, swarm_id: "" })}
                      disabled={disabled}
                      clearable
                    />
                  </ConfigItem>
                );
              },
            },
          },
          {
            label:
              (update.image ?? config.image)?.type === "Build"
                ? "Build"
                : "Image",
            description:
              "直接指定 Docker 镜像，或选择要部署的构建",
            fields: {
              image: (value, set) => (
                <DeploymentImageConfig
                  image={value}
                  setUpdate={set}
                  disabled={disabled}
                />
              ),
              image_registry_account: (account, set) => {
                const image = update.image ?? config.image;
                const provider =
                  image?.type === "Image" && image.params.image
                    ? extractRegistryDomain(image.params.image)
                    : image?.type === "Build" && image.params.build_id
                      ? builds?.find((b) => b.id === image.params.build_id)
                          ?.info.image_registry_domain
                      : undefined;
                return (
                  <AccountSelectorConfig
                    id={update.server_id ?? config.server_id ?? undefined}
                    type="Server"
                    accountType="docker"
                    provider={provider ?? "docker.io"}
                    selected={account}
                    onSelect={(image_registry_account) =>
                      set({ image_registry_account })
                    }
                    disabled={disabled}
                    placeholder={
                      image?.type === "Build" ? "与构建相同" : undefined
                    }
                    description={
                      image?.type === "Build"
                        ? "选择其他账户登录镜像提供方"
                        : undefined
                    }
                  />
                );
              },
              redeploy_on_build: (update.image?.type ?? config.image?.type) ===
                "Build" && {
                description: "镜像构建完成后自动重新部署。",
              },
            },
          },
          {
            label: "网络",
            labelHidden: true,
            fields: {
              network: (value, set) => (
                <DeploymentNetworkSelector
                  swarmId={update.swarm_id ?? config.swarm_id}
                  serverId={update.server_id ?? config.server_id}
                  selected={value}
                  onSelect={(network) => set({ network })}
                  disabled={disabled}
                />
              ),
              ports:
                !hidePorts &&
                ((ports, set) => (
                  <ConfigItem
                    label="端口"
                    description="配置端口映射。"
                  >
                    <MonacoEditor
                      value={ports || "  # 3000:3000\n"}
                      language="key_value"
                      onValueChange={(ports) => set({ ports })}
                      readOnly={disabled}
                    />
                  </ConfigItem>
                )),
              links: (values, set) => (
                <ConfigList
                  label="链接"
                  description="在资源页顶部添加快捷链接"
                  field="links"
                  values={values ?? []}
                  set={set}
                  disabled={disabled}
                  placeholder="输入链接"
                />
              ),
            },
          },
          {
            label: "环境变量",
            description: "将这些变量传入容器",
            fields: {
              environment: (env, set) => (
                <Stack>
                  <SecretsSearch
                    server={update.server_id ?? config.server_id}
                  />
                  <MonacoEditor
                    value={env || "  # VARIABLE = value\n"}
                    onValueChange={(environment) => set({ environment })}
                    language="key_value"
                    readOnly={disabled}
                  />
                </Stack>
              ),
              // skip_secret_interp: true,
            },
          },
          {
            label: "卷",
            description: "配置卷挂载。",
            fields: {
              volumes: (volumes, set) => (
                <MonacoEditor
                  value={volumes || "  # volume:/container/path\n"}
                  language="key_value"
                  onValueChange={(volumes) => set({ volumes })}
                  readOnly={disabled}
                />
              ),
            },
          },
          {
            label: "重启",
            hidden: !!currSwarmId,
            labelHidden: true,
            fields: {
              restart: (value, set) => (
                <DeploymentRestartSelector
                  selected={value}
                  set={set}
                  disabled={disabled}
                />
              ),
            },
          },
          {
            label: "自动更新",
            hidden: (update.image ?? config.image)?.type === "Build",
            fields: {
              poll_for_updates: (poll, set) => {
                return (
                  <ConfigSwitch
                    label="检查更新"
                    description="在全局自动更新时检查镜像更新。"
                    value={autoUpdate || poll}
                    onCheckedChange={(poll_for_updates) =>
                      set({ poll_for_updates })
                    }
                    disabled={disabled || autoUpdate}
                  />
                );
              },
              auto_update: {
                description: "发现新镜像时触发重新部署。",
              },
            },
          },
        ],
        advanced: [
          {
            label: "自定义名称",
            labelHidden: true,
            fields: {
              custom_name: {
                placeholder: `自定义${currServerId ? "服务" : "容器"}名称`,
                description: currSwarmId
                  ? "可选。设置与部署名称不同的自定义服务名称。"
                  : "可选。设置与部署名称不同的自定义容器名称。",
              },
            },
          },
          {
            label: "命令",
            labelHidden: true,
            fields: {
              command: (value, set) => (
                <ConfigItem
                  label="命令"
                  description={
                    <Group>
                      <Text>替换 CMD，或扩展 ENTRYPOINT。</Text>
                      <Link
                        to={
                          currSwarmId
                            ? "https://docs.docker.com/reference/cli/docker/service/create/#create-a-service"
                            : "https://docs.docker.com/engine/reference/run/#commands-and-arguments"
                        }
                        target="_blank"
                      >
                        查看 Docker 文档。
                      </Link>
                    </Group>
                  }
                >
                  <MonacoEditor
                    value={value}
                    language="shell"
                    onValueChange={(command) => set({ command })}
                    readOnly={disabled}
                  />
                </ConfigItem>
              ),
            },
          },
          {
            label: "标签",
            description: "通过 --labels 为容器添加标签。",
            fields: {
              labels: (labels, set) => (
                <MonacoEditor
                  value={labels || "  # your.docker.label: value\n"}
                  language="key_value"
                  onValueChange={(labels) => set({ labels })}
                  readOnly={disabled}
                />
              ),
            },
          },
          {
            label: "额外参数",
            labelHidden: true,
            fields: {
              extra_args: (value, set) => (
                <ConfigItem
                  label="额外参数"
                  description={
                    <div className="flex flex-row flex-wrap gap-2">
                      <div>
                        传递额外参数给 '
                        {currSwarmId ? "docker service create" : "docker run"}
                        '.
                      </div>
                      <Link
                        to={
                          currSwarmId
                            ? "https://docs.docker.com/reference/cli/docker/service/create/#options"
                            : "https://docs.docker.com/reference/cli/docker/container/run/#options"
                        }
                        target="_blank"
                        className="text-primary"
                      >
                        查看 Docker 文档。
                      </Link>
                    </div>
                  }
                >
                  {!disabled && (
                    <AddExtraArg
                      type="Deployment"
                      onSelect={(suggestion) =>
                        set({
                          extra_args: [
                            ...(update.extra_args ?? config.extra_args ?? []),
                            suggestion,
                          ],
                        })
                      }
                      disabled={disabled}
                    />
                  )}
                  <InputList
                    field="extra_args"
                    values={value ?? []}
                    set={set}
                    disabled={disabled}
                    placeholder="--extra-arg=value"
                  />
                </ConfigItem>
              ),
            },
          },
          {
            label: "终止",
            hidden: !!currSwarmId,
            description:
              "配置 docker stop 停止容器时使用的信号。可选 SIGTERM、SIGQUIT、SIGINT 和 SIGHUP。",
            fields: {
              termination_signal: (value, set) => (
                <TerminationSignal arg={value} set={set} disabled={disabled} />
              ),
              termination_timeout: (value, set) => (
                <TerminationTimeout arg={value} set={set} disabled={disabled} />
              ),
              term_signal_labels: (value, set) => (
                <ConfigItem
                  label="终止信号标签"
                  description="停止时可选择不同信号"
                >
                  <MonacoEditor
                    value={value || DEFAULT_TERM_SIGNAL_LABELS}
                    language="key_value"
                    onValueChange={(term_signal_labels) =>
                      set({ term_signal_labels })
                    }
                    readOnly={disabled}
                  />
                </ConfigItem>
              ),
            },
          },
        ],
      }}
    />
  );
}

const DEFAULT_TERM_SIGNAL_LABELS = `  # SIGTERM: sigterm label
  # SIGQUIT: sigquit label
  # SIGINT: sigint label
  # SIGHUP: sighup label
`;
