import { displayLabel } from "@/lib/l10n";
import {
  usePermissions,
  useRead,
  useWebhookIdOrName,
  useWebhookIntegrations,
  useWrite,
} from "@/lib/hooks";
import { ICONS } from "@/lib/icons";
import {
  Config,
  ConfigGroupArgs,
  ConfigProps,
  ConfigItem,
  ConfigList,
  ConfigSwitch,
} from "mogh_ui";
import {
  ActionIcon,
  Button,
  Group,
  MultiSelect,
  Select,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { useLocalStorage } from "@mantine/hooks";
import { Types } from "komodo_client";
import ResourceLink from "@/resources/link";
import ResourceSelector from "@/resources/selector";
import { ShowHideButton } from "mogh_ui";
import SecretsSearch from "@/components/config/secrets-search";
import { MonacoEditor } from "mogh_ui";
import { EnableSwitch } from "mogh_ui";
import StackConfigFiles from "./config-files";
import SystemCommand from "@/components/config/system-command";
import { Link } from "react-router-dom";
import AddExtraArg from "@/components/config/add-extra-arg";
import { InputList } from "mogh_ui";
import { ProviderSelectorConfig } from "@/components/config/provider-selector";
import { AccountSelectorConfig } from "@/components/config/account-selector";
import LinkedRepo from "@/components/config/linked-repo";
import { DEFAULT_STACK_FILE_CONTENTS, useFullStack } from "..";
import { ReactNode } from "react";
import WebhookBuilder from "@/components/webhook/builder";
import CopyWebhookUrl from "@/components/webhook/copy-url";

type StackMode = "UI Defined" | "Files On Server" | "Git Repo" | undefined;
const STACK_MODES = ["UI Defined", "Files On Server", "Git Repo"] as const;

export function getStackMode(
  update: Partial<Types.StackConfig>,
  config: Types.StackConfig,
): StackMode {
  if (update.files_on_host ?? config.files_on_host) return "Files On Server";
  if (
    (update.linked_repo ?? config.linked_repo) ||
    (update.repo ?? config.repo)
  )
    return "Git Repo";
  if (update.file_contents ?? config.file_contents) return "UI Defined";
  return undefined;
}

export default function StackConfig({
  id,
  titleOther,
}: {
  id: string;
  titleOther: ReactNode;
}) {
  const [show, setShow] = useLocalStorage({
    key: `stack-${id}-show`,
    defaultValue: {
      file: true,
      env: true,
      webhooks: true,
    },
  });
  const { canWrite } = usePermissions({ type: "Stack", id });
  const stack = useFullStack(id);
  const allServices =
    (stack?.info?.deployed_services ?? stack?.info?.latest_services)?.map(
      (s) => s.service_name,
    ) ?? [];
  const config = stack?.config;
  const name = stack?.name;
  const global_disabled =
    useRead("GetCoreInfo", {}).data?.ui_write_disabled ?? false;
  const swarmsExist = useRead("ListSwarms", {}).data?.length ? true : false;
  const [update, setUpdate] = useLocalStorage<Partial<Types.StackConfig>>({
    key: `stack-${id}-update-v1`,
    defaultValue: {},
  });
  const { mutateAsync } = useWrite("UpdateStack");
  const { getIntegration } = useWebhookIntegrations();
  const [idOrName] = useWebhookIdOrName();

  if (!config) return null;

  const disabled = global_disabled || !canWrite;

  const runBuild = update.run_build ?? config.run_build;
  const autoOrPollUpdates =
    (update.auto_update ?? config.auto_update) ||
    (update.poll_for_updates ?? config.poll_for_updates);

  const mode = getStackMode(update, config);

  const gitProvider = update.git_provider ?? config.git_provider;
  const webhookIntegration = getIntegration(gitProvider);

  const setMode = (mode: StackMode) => {
    if (mode === "Files On Server") {
      setUpdate({ ...update, files_on_host: true });
    } else if (mode === "Git Repo") {
      setUpdate({
        ...update,
        files_on_host: false,
        repo: update.repo || config.repo || "namespace/repo",
      });
    } else if (mode === "UI Defined") {
      setUpdate({
        ...update,
        files_on_host: false,
        repo: "",
        file_contents:
          update.file_contents ||
          config.file_contents ||
          DEFAULT_STACK_FILE_CONTENTS,
      });
    } else if (mode === undefined) {
      setUpdate({
        ...update,
        files_on_host: false,
        repo: "",
        file_contents: "",
      });
    }
  };

  let groups: ConfigProps<Types.StackConfig>["groups"] = {};

  const currSwarmId = update.swarm_id ?? config.swarm_id;
  const currServerId = update.server_id ?? config.server_id;

  const swarmServerGroup: ConfigGroupArgs<Types.StackConfig>[] = [
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
  ];

  const chooseMode: ConfigGroupArgs<Types.StackConfig> = {
    label: "选择模式",
    labelHidden: true,
    fields: {
      server_id: () => {
        return (
          <ConfigItem
            label="选择模式"
            description="选择在界面中编辑文件、使用服务器上的文件，或从 Git 仓库拉取。"
          >
            <Select
              w="fit-content"
              placeholder="选择模式"
              value={mode}
              onChange={(mode) => mode && setMode(mode as StackMode)}
              disabled={disabled}
              data={STACK_MODES.map((value) => ({ value, label: displayLabel(value) }))}
            />
          </ConfigItem>
        );
      },
    },
  };

  const environment: ConfigGroupArgs<Types.StackConfig> = {
    label: "环境变量",
    description: `将这些变量传入 docker ${currSwarmId ? "stack" : "compose"} 命令`,
    actions: (
      <ShowHideButton
        show={show.env}
        setShow={(env) => setShow({ ...show, env })}
      />
    ),
    contentHidden: !show.env,
    fields: {
      environment: (env, set) => (
        <Stack>
          <SecretsSearch server={update.server_id ?? config.server_id} />
          <MonacoEditor
            value={env || "  # VARIABLE = value\n"}
            onValueChange={(environment) => set({ environment })}
            language="key_value"
            readOnly={disabled}
          />
        </Stack>
      ),
      env_file_path: {
        description:
          "要写入的文件路径，相对于“运行目录”。",
        placeholder: ".env",
      },
      additional_env_files:
        (mode === "Files On Server" || mode === "Git Repo") &&
        ((values, set) => {
          const files = (values ?? []).map((v: any) =>
            typeof v === "string" ? { path: v, track: true } : v,
          );
          return (
            <ConfigItem label="额外环境文件">
              <Stack>
                {files.map((file: any, i: number) => (
                  <Group key={i}>
                    <TextInput
                      value={file.path || ""}
                      onChange={(e) => {
                        set({
                          additional_env_files: files.map((v, index) =>
                            i === index
                              ? {
                                  path: e.target.value,
                                  track: file.track ?? true,
                                }
                              : v,
                          ),
                        });
                      }}
                      placeholder=".env"
                      disabled={disabled}
                      w={400}
                      maw="100%"
                    />
                    <Group>
                      <EnableSwitch
                        label="跟踪"
                        checked={file.track ?? true}
                        onCheckedChange={(track) => {
                          set({
                            additional_env_files: files.map((v, index) =>
                              i === index ? { ...v, track } : v,
                            ),
                          });
                        }}
                        disabled={disabled}
                        id={`track-${i}`}
                      />
                    </Group>
                    {!disabled && (
                      <ActionIcon
                        color="red"
                        onClick={() => {
                          set({
                            additional_env_files: files.filter(
                              (_: any, idx: number) => idx !== i,
                            ),
                          });
                        }}
                      >
                        <ICONS.Remove size="1rem" />
                      </ActionIcon>
                    )}
                  </Group>
                ))}
                {!disabled && (
                  <Button
                    onClick={() => {
                      set({
                        additional_env_files: [
                          ...files,
                          { path: "", track: true },
                        ],
                      });
                    }}
                    leftSection={<ICONS.Add size="1rem" />}
                    w={{ base: "85%", lg: 400 }}
                  >
                    添加环境文件
                  </Button>
                )}
                <Text c="dimmed" fz="sm">
                  添加通过 --env-file 传入的额外环境文件，路径相对于“运行目录”。外部管理的文件（如通过 sops 解密的文件）请取消“跟踪”。
                </Text>
              </Stack>
            </ConfigItem>
          );
        }),
    },
  };

  const configFiles: ConfigGroupArgs<Types.StackConfig> = {
    label: "配置文件",
    labelHidden: true,
    fields: {
      config_files: (value, set) => (
        <ConfigItem
          label="配置文件"
          description="添加应用栈关联的其他配置文件，并在界面中编辑。路径相对于“运行目录”。"
        >
          <StackConfigFiles
            id={id}
            value={value}
            set={set}
            disabled={disabled}
          />
        </ConfigItem>
      ),
    },
  };

  const auto_update = update.auto_update ?? config.auto_update ?? false;

  const generalCommon: ConfigGroupArgs<Types.StackConfig>[] = [
    {
      label: "自动更新",
      labelHidden: true,
      fields: {
        poll_for_updates: (poll, set) => {
          return (
            <ConfigSwitch
              label="检查更新"
              description="在全局自动更新时检查镜像更新。"
              value={auto_update || poll}
              onCheckedChange={(poll_for_updates) => set({ poll_for_updates })}
              disabled={disabled || auto_update}
            />
          );
        },
        auto_update_skip_services: (values, set) =>
          autoOrPollUpdates && (
            <ConfigItem
              label="自动更新时忽略服务"
              description="仅在全局自动更新检查时跳过这些服务，手动检查仍包含全部服务。"
            >
              <MultiSelect
                leftSection={<ICONS.Service size="1rem" />}
                placeholder={
                  values?.length ? "添加服务" : "选择服务"
                }
                value={values}
                data={allServices}
                onChange={(auto_update_skip_services) =>
                  set({ auto_update_skip_services })
                }
                disabled={disabled}
                w="fit-content"
                searchable
                clearable
              />
            </ConfigItem>
          ),
        auto_update: {
          description: "发现新镜像时触发重新部署。",
        },
        auto_update_all_services: (value, set) => {
          return (
            <ConfigSwitch
              label="完整应用栈自动更新"
              description="始终重新部署整个应用栈，而非仅部署有更新的服务。"
              value={value}
              onCheckedChange={(auto_update_all_services) =>
                set({ auto_update_all_services })
              }
              disabled={disabled || !auto_update}
            />
          );
        },
      },
    },
    {
      label: "链接",
      labelHidden: true,
      fields: {
        links: (values, set) => (
          <ConfigList
            label="链接"
            addLabel="添加链接"
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
  ];

  const advanced: ConfigGroupArgs<Types.StackConfig>[] = [
    {
      label: "项目名称",
      labelHidden: true,
      fields: {
        project_name: {
          placeholder: "Compose 项目名称",
          description:
            "可选。设置其他 Compose 项目名称。导入现有应用栈时，需与主机上的 Compose 项目名称一致。",
        },
      },
    },
    {
      label: "部署前操作",
      labelHidden: true,
      fields: {
        pre_deploy: (value, set) => (
          <ConfigItem
            label="部署前操作"
            description="运行 docker compose up 前执行 Shell 命令。path 相对于运行目录"
          >
            <SystemCommand
              value={value}
              set={(value) => set({ pre_deploy: value })}
              disabled={disabled}
            />
          </ConfigItem>
        ),
      },
    },
    {
      label: "部署后操作",
      labelHidden: true,
      fields: {
        post_deploy: (value, set) => (
          <ConfigItem
            label="部署后操作"
            description="运行 docker compose up 后执行 Shell 命令。path 相对于运行目录"
          >
            <SystemCommand
              value={value}
              set={(value) => set({ post_deploy: value })}
              disabled={disabled}
            />
          </ConfigItem>
        ),
      },
    },
    {
      label: "命令包装器",
      description: "可选。为密钥管理工具配置命令包装器。",
      fields: {
        compose_cmd_wrapper: (value, set) => (
          <MonacoEditor
            value={
              value || "# sops exec-env .encrypted.env '[[COMPOSE_COMMAND]]'\n"
            }
            language="shell"
            onValueChange={(compose_cmd_wrapper) =>
              set({ compose_cmd_wrapper })
            }
            readOnly={disabled}
          />
        ),
        compose_cmd_wrapper_include: (values, set) => {
          const commands = currSwarmId
            ? ["config", "deploy"]
            : ["config", "build", "pull", "up", "run"];
          const filtered = (values ?? []).filter((v: string) =>
            commands.includes(v),
          );
          return (
            <ConfigItem
              label="应用范围"
              description={`选择需要包装的 docker ${currSwarmId ? "stack" : "compose"} 子命令。`}
            >
              <MultiSelect
                placeholder={
                  filtered.length ? "添加命令" : "选择命令"
                }
                value={filtered}
                data={commands}
                onChange={(compose_cmd_wrapper_include) =>
                  set({ compose_cmd_wrapper_include })
                }
                disabled={disabled}
                w="fit-content"
                clearable
              />
            </ConfigItem>
          );
        },
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
              <Group gap="xs">
                <Text>
                  传递额外参数给 docker '
                  {currSwarmId ? "stack deploy" : "compose up"}
                  '.
                </Text>
                <Text
                  className="hover-underline"
                  fw="bold"
                  component={Link}
                  to={
                    currSwarmId
                      ? "https://docs.docker.com/reference/cli/docker/stack/deploy/#options"
                      : "https://docs.docker.com/reference/cli/docker/service/create/#options"
                  }
                  target="_blank"
                >
                  查看 Docker 文档。
                </Text>
              </Group>
            }
          >
            <InputList
              field="extra_args"
              values={value ?? []}
              set={set}
              disabled={disabled}
              placeholder="--extra-arg=value"
            />
            {!disabled && (
              <AddExtraArg
                type="Stack"
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
          </ConfigItem>
        ),
      },
    },
    {
      label: "忽略服务",
      labelHidden: true,
      fields: {
        ignore_services: (values, set) => (
          <ConfigItem
            label="忽略服务"
            description="若 Compose 文件中的初始化服务会提前退出，可在此忽略它们，以正确显示应用栈健康状态。"
          >
            <MultiSelect
              leftSection={<ICONS.Service size="1rem" />}
              placeholder={values?.length ? "添加服务" : "选择服务"}
              value={values}
              data={allServices}
              onChange={(ignore_services) => set({ ignore_services })}
              disabled={disabled}
              w="fit-content"
              searchable
              clearable
            />
          </ConfigItem>
        ),
      },
    },
    {
      label: "拉取镜像",
      labelHidden: true,
      fields: {
        registry_provider: (provider, set) => {
          return (
            <ProviderSelectorConfig
              description="登录镜像仓库以访问私有镜像。"
              accountType="docker"
              selected={provider}
              disabled={disabled}
              onSelect={(registry_provider) => set({ registry_provider })}
            />
          );
        },
        registry_account: (value, set) => {
          const server_id = update.server_id || config.server_id;
          const provider = update.registry_provider ?? config.registry_provider;
          if (!provider) {
            return null;
          }
          return (
            <AccountSelectorConfig
              id={server_id}
              type={server_id ? "Server" : "None"}
              accountType="docker"
              provider={provider}
              selected={value}
              onSelect={(registry_account) => set({ registry_account })}
              disabled={disabled}
              placeholder="无"
            />
          );
        },
        auto_pull: {
          label: "部署前拉取镜像",
          hidden: !!currSwarmId,
          description:
            "重新部署应用栈前运行 docker compose pull。也可在 Compose 文件中设置 pull_policy。",
        },
      },
    },
    {
      label: "构建镜像",
      hidden: !!currSwarmId,
      labelHidden: true,
      fields: {
        run_build: {
          label: "部署前构建镜像",
          description:
            "重新部署应用栈前运行 docker compose build。也可将 --build 添加为额外参数。",
        },
        build_extra_args: (value, set) =>
          runBuild && (
            <ConfigItem
              label="构建额外参数"
              description="添加在 docker compose build 后的额外参数"
            >
              {!disabled && (
                <AddExtraArg
                  type="StackBuild"
                  onSelect={(suggestion) =>
                    set({
                      build_extra_args: [
                        ...(update.build_extra_args ??
                          config.build_extra_args ??
                          []),
                        suggestion,
                      ],
                    })
                  }
                  disabled={disabled}
                />
              )}
              <InputList
                field="build_extra_args"
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
      label: "销毁",
      labelHidden: true,
      fields: {
        destroy_before_deploy: {
          label: "部署前销毁",
          description: `重新部署应用栈前运行 ${
            currSwarmId ? "docker stack rm" : "docker compose down"
          }。`,
        },
      },
    },
  ];

  if (mode === undefined) {
    groups = {
      "": [...swarmServerGroup, chooseMode],
    };
  } else if (mode === "Files On Server") {
    groups = {
      "": [
        ...swarmServerGroup,
        {
          label: "文件",
          labelHidden: true,
          fields: {
            run_directory: {
              label: "运行目录",
              description: `设置运行 compose up 命令时的工作目录。可使用绝对路径，或相对于 $PERIPHERY_STACK_DIR/${stack.name} 的路径`,
              placeholder: "/path/to/folder",
            },
            file_paths: (value, set) => (
              <ConfigList
                label="文件路径"
                description="添加通过 docker compose -f 使用的文件。留空时使用 compose.yaml。路径相对于“运行目录”。"
                field="file_paths"
                values={value ?? []}
                set={set}
                disabled={disabled}
                placeholder="compose.yaml"
              />
            ),
          },
        },
        environment,
        configFiles,
        ...generalCommon,
      ],
      advanced,
    };
  } else if (mode === "Git Repo") {
    const repoLinked = !!(update.linked_repo ?? config.linked_repo);
    groups = {
      "": [
        ...swarmServerGroup,
        {
          label: "来源",
          labelHidden: true,
          fields: {
            linked_repo: (linkedRepo, set) => (
              <LinkedRepo
                linkedRepo={linkedRepo}
                repoLinked={repoLinked}
                set={set}
                disabled={disabled}
              />
            ),
            ...(!repoLinked
              ? {
                  git_provider: (provider, set) => {
                    const https = update.git_https ?? config.git_https;
                    return (
                      <ProviderSelectorConfig
                        accountType="git"
                        selected={provider}
                        disabled={disabled}
                        onSelect={(git_provider) => set({ git_provider })}
                        https={https}
                        onHttpsSwitch={() => set({ git_https: !https })}
                      />
                    );
                  },
                  git_account: (value, set) => {
                    const server_id = update.server_id || config.server_id;
                    return (
                      <AccountSelectorConfig
                        id={server_id}
                        type={server_id ? "Server" : "None"}
                        accountType="git"
                        provider={update.git_provider ?? config.git_provider}
                        selected={value}
                        onSelect={(git_account) => set({ git_account })}
                        disabled={disabled}
                        placeholder="无"
                      />
                    );
                  },
                  repo: {
                    placeholder: "输入代码仓库",
                    description:
                      "代码托管平台上的仓库路径：{namespace}/{repo_name}",
                  },
                  branch: {
                    placeholder: "输入分支",
                    description:
                      "选择自定义分支，默认为 main。",
                  },
                  commit: {
                    label: "提交哈希",
                    placeholder: "输入提交哈希",
                    description:
                      "可选。克隆分支后切换到指定提交。",
                  },
                  clone_path: {
                    placeholder: "/clone/path/on/host",
                    description: (
                      <Stack gap="0">
                        <Text component="span">
                          指定主机上用于克隆代码仓库的文件夹。
                        </Text>
                        <Text component="span">
                          若为 <b>相对路径</b> （不以 / 开头），则相对于{" "}
                          {"$root_directory/stacks/" + stack.name}
                        </Text>
                      </Stack>
                    ),
                  },
                }
              : {}),
            reclone: {
              description:
                "删除代码仓库目录并重新克隆，代替执行 git pull。",
            },
          },
        },
        {
          label: "文件",
          labelHidden: true,
          fields: {
            run_directory: {
              description: (
                <>
                  设置运行 compose up 命令时的工作目录，
                  <b>相对于代码仓库根目录。</b>
                </>
              ),
              placeholder: "path/to/folder",
            },
            file_paths: (value, set) => (
              <ConfigList
                label="文件路径"
                description="添加通过 docker compose -f 使用的文件。留空时使用 compose.yaml。路径相对于“运行目录”。"
                field="file_paths"
                values={value ?? []}
                set={set}
                disabled={disabled}
                placeholder="compose.yaml"
              />
            ),
          },
        },
        environment,
        configFiles,
        ...generalCommon,
        {
          label: "Webhook",
          description: `复制此处的 Webhook 地址，并在兼容 ${webhookIntegration} 的代码托管平台中配置向 Komodo 发送 Webhook`,
          actions: (
            <ShowHideButton
              show={show.webhooks}
              setShow={(webhooks) => setShow({ ...show, webhooks })}
            />
          ),
          contentHidden: !show.webhooks,
          fields: {
            ["Guard" as any]: () => {
              if (update.branch ?? config.branch) {
                return null;
              }
              return (
                <ConfigItem label="配置分支">
                  <Text>需先配置分支，Webhook 才能生效。</Text>
                </ConfigItem>
              );
            },
            ["Builder" as any]: () => (
              <WebhookBuilder gitProvider={gitProvider} />
            ),
            ["Deploy" as any]: () =>
              (update.branch ?? config.branch) && (
                <CopyWebhookUrl
                  label="Webhook 地址 - 部署"
                  integration={webhookIntegration}
                  path={`/stack/${idOrName === "Id" ? id : encodeURIComponent(name ?? "...")}/deploy`}
                />
              ),
            webhook_force_deploy: {
              description:
                "通常仅在文件发生变化时部署应用栈。启用此项可强制部署。",
            },
            webhook_enabled: true,
            webhook_secret: {
              description:
                "为此资源设置自定义 Webhook 密钥，或使用全局默认值。",
              placeholder: "输入自定义密钥",
            },
          },
        },
      ],
      advanced,
    };
  } else if (mode === "UI Defined") {
    groups = {
      "": [
        ...swarmServerGroup,
        {
          label: "Compose 文件",
          description: "在此管理 Compose 文件内容。",
          actions: (
            <ShowHideButton
              show={show.file}
              setShow={(file) => setShow({ ...show, file })}
            />
          ),
          contentHidden: !show.file,
          fields: {
            file_contents: (file_contents, set) => {
              const show_default =
                !file_contents &&
                update.file_contents === undefined &&
                !(update.repo ?? config.repo);
              return (
                <Stack>
                  <SecretsSearch />
                  <MonacoEditor
                    value={
                      show_default ? DEFAULT_STACK_FILE_CONTENTS : file_contents
                    }
                    filename="compose.yaml"
                    onValueChange={(file_contents) => set({ file_contents })}
                    language="yaml"
                    readOnly={disabled}
                  />
                </Stack>
              );
            },
          },
        },
        environment,
        ...generalCommon,
      ],
      advanced,
    };
  }

  return (
    <Config
      titleOther={titleOther}
      disabled={disabled}
      original={config}
      update={update}
      setUpdate={setUpdate}
      onSave={async () => {
        await mutateAsync({ id, config: update });
      }}
      groups={groups}
      fileContentsLanguage="yaml"
    />
  );
}
