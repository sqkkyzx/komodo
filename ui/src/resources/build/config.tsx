import { displayLabel } from "@/lib/l10n";
import {
  usePermissions,
  useRead,
  useWebhookIdOrName,
  useWebhookIntegrations,
  useWrite,
} from "@/lib/hooks";
import {
  Config,
  ConfigGroupArgs,
  ConfigProps,
  ConfigInput,
  ConfigItem,
  ConfigList,
} from "mogh_ui";
import { useLocalStorage } from "@mantine/hooks";
import { Types } from "komodo_client";
import ResourceSelector from "@/resources/selector";
import ResourceLink from "@/resources/link";
import { Button, Group, Select, Stack, Text } from "@mantine/core";
import { ICONS } from "@/lib/icons";
import ImageRegistryConfig from "@/components/config/image-registry-config";
import SystemCommand from "@/components/config/system-command";
import { MonacoEditor } from "mogh_ui";
import SecretsSearch from "@/components/config/secrets-search";
import { Link } from "react-router-dom";
import AddExtraArg from "@/components/config/add-extra-arg";
import { InputList } from "mogh_ui";
import { ShowHideButton } from "mogh_ui";
import LinkedRepo from "@/components/config/linked-repo";
import { ProviderSelectorConfig } from "@/components/config/provider-selector";
import { AccountSelectorConfig } from "@/components/config/account-selector";
import { ReactNode } from "react";
import WebhookBuilder from "@/components/webhook/builder";
import CopyWebhookUrl from "@/components/webhook/copy-url";
import { useFullBuild } from ".";

type BuildMode = "UI Defined" | "Files On Server" | "Git Repo" | undefined;
const BUILD_MODES = ["UI Defined", "Files On Server", "Git Repo"] as const;

function getBuildMode(
  update: Partial<Types.BuildConfig>,
  config: Types.BuildConfig,
): BuildMode {
  if (update.files_on_host ?? config.files_on_host) return "Files On Server";
  if (
    (update.repo ?? config.repo) ||
    (update.linked_repo ?? config.linked_repo)
  )
    return "Git Repo";
  if (update.dockerfile ?? config.dockerfile) return "UI Defined";
  return undefined;
}

export const DEFAULT_BUILD_DOCKERFILE_CONTENTS = `## Add your dockerfile here
FROM debian:stable-slim
RUN echo 'Hello Komodo'
`;

export default function BuildConfig({
  id,
  titleOther,
}: {
  id: string;
  titleOther: ReactNode;
}) {
  const [show, setShow] = useLocalStorage({
    key: `build-${id}-show`,
    defaultValue: {
      file: true,
      git: true,
      webhooks: true,
    },
  });
  const { canWrite } = usePermissions({ type: "Build", id });
  const build = useFullBuild(id);
  const config = build?.config;
  const name = build?.name;
  const globalDisabled =
    useRead("GetCoreInfo", {}).data?.ui_write_disabled ?? false;
  const [update, setUpdate] = useLocalStorage<Partial<Types.BuildConfig>>({
    key: `build-${id}-update-v1`,
    defaultValue: {},
  });
  const { mutateAsync } = useWrite("UpdateBuild");
  const { getIntegration } = useWebhookIntegrations();
  const [idOrName] = useWebhookIdOrName();

  if (!config) return null;

  const disabled = globalDisabled || !canWrite;

  const gitProvider = update.git_provider ?? config.git_provider;
  const webhookIntegration = getIntegration(gitProvider);

  const mode = getBuildMode(update, config);

  const setMode = (mode: BuildMode) => {
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
        dockerfile:
          update.dockerfile ||
          config.dockerfile ||
          DEFAULT_BUILD_DOCKERFILE_CONTENTS,
      });
    } else if (mode === undefined) {
      setUpdate({
        ...update,
        files_on_host: false,
        repo: "",
        dockerfile: "",
      });
    }
  };

  let groups: ConfigProps<Types.BuildConfig>["groups"] = {};

  const builderGroup: ConfigGroupArgs<Types.BuildConfig> = {
    label: "构建器",
    labelHidden: true,
    fields: {
      builder_id(builderId, set) {
        return (
          <ConfigItem
            label={
              builderId ? (
                <Group fz="h3" fw="bold">
                  构建器：
                  <ResourceLink
                    type="Builder"
                    id={builderId}
                    fz="h3"
                    iconSize="1.2rem"
                  />
                </Group>
              ) : (
                "选择构建器"
              )
            }
            description="选择用于构建的构建器。"
          >
            <ResourceSelector
              type="Builder"
              selected={builderId}
              onSelect={(builder_id) => set({ builder_id })}
              disabled={disabled}
              clearable
            />
          </ConfigItem>
        );
      },
    },
  };

  const versionGroup: ConfigGroupArgs<Types.BuildConfig> = {
    label: "版本",
    labelHidden: true,
    fields: {
      version: (_version, set) => {
        const version =
          typeof _version === "object"
            ? `${_version.major}.${_version.minor}.${_version.patch}`
            : _version;
        return (
          <ConfigInput
            inputProps={{ size: "lg" }}
            label="版本"
            description="使用 major.minor.patch 为镜像设置版本，可通过 [[$VERSION]] 引用。"
            placeholder="0.0.0"
            value={version}
            onValueChange={(version) => set({ version: version as any })}
            disabled={disabled}
          />
        );
      },
      auto_increment_version: {
        description: "每次构建时自动递增补丁版本号。",
      },
    },
  };

  const chooseMode: ConfigGroupArgs<Types.BuildConfig> = {
    label: "选择模式",
    labelHidden: true,
    fields: {
      builder_id: () => {
        return (
          <ConfigItem
            label="选择模式"
            description="选择在界面中编辑 Dockerfile、使用服务器上的文件，或从 Git 仓库拉取。"
          >
            <Select
              w="fit-content"
              placeholder="选择模式"
              value={mode}
              onChange={(mode) => mode && setMode(mode as BuildMode)}
              data={BUILD_MODES.map((value) => ({ value, label: displayLabel(value) }))}
              disabled={disabled}
            />
          </ConfigItem>
        );
      },
    },
  };

  const imageName = (update.image_name ?? config.image_name) || name;
  const customTag = update.image_tag ?? config.image_tag;
  const customTagPostfix = customTag ? `-${customTag}` : "";

  const generalCommon: ConfigGroupArgs<Types.BuildConfig>[] = [
    {
      label: "镜像仓库",
      labelHidden: true,
      fields: {
        image_registry: (image_registries, set) => (
          <ConfigItem
            label="镜像仓库"
            description="配置构建完成后镜像的推送位置。"
            gap="xl"
          >
            {!disabled && (
              <Button
                onClick={() =>
                  set({
                    image_registry: [
                      ...(image_registries ?? []),
                      { domain: "", organization: "", account: "" },
                    ],
                  })
                }
                w={200}
              >
                <ICONS.Create size="1rem" />
                添加镜像仓库
              </Button>
            )}

            {image_registries?.map((registry, index) => (
              <ImageRegistryConfig
                key={index}
                registry={registry}
                imageName={imageName}
                setRegistry={(registry) =>
                  set({
                    image_registry:
                      image_registries?.map((r, i) =>
                        i === index ? registry : r,
                      ) ?? [],
                  })
                }
                onRemove={() =>
                  set({
                    image_registry:
                      image_registries?.filter((_, i) => i !== index) ?? [],
                  })
                }
                builderId={update.builder_id ?? config.builder_id}
                disabled={disabled}
              />
            ))}
          </ConfigItem>
        ),
      },
    },
    {
      label: "镜像标签",
      labelHidden: true,
      fields: {
        image_name: {
          description: "使用其他名称推送镜像",
          placeholder: "自定义镜像名称",
        },
        image_tag: {
          description: `推送自定义标签，并为其他标签添加后缀（如 :latest-${customTag ? customTag : "<TAG>"}）。`,
          placeholder: "自定义镜像标签",
        },
        include_latest_tag: {
          description: `:latest${customTagPostfix}`,
        },
        include_version_tags: {
          description: `:X.Y.Z${customTagPostfix} + :X.Y${customTagPostfix} + :X${customTagPostfix}`,
        },
        include_commit_tag: {
          description: `:ae8f8ff${customTagPostfix}`,
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

  const advanced: ConfigGroupArgs<Types.BuildConfig>[] = [
    {
      label: "构建前操作",
      description:
        "运行 docker build 前执行 Shell 命令。path 相对于代码仓库根目录。",
      fields: {
        pre_build: (value, set) => (
          <SystemCommand
            value={value}
            set={(value) => set({ pre_build: value })}
            disabled={disabled}
          />
        ),
      },
    },
    {
      label: "构建参数",
      description:
        "向 docker build 传递构建参数。可在 Dockerfile 中通过 ARG 使用，这些参数在最终镜像中可见。",
      labelExtra: !disabled && (
        <SecretsSearch builder={update.builder_id ?? config.builder_id} />
      ),
      fields: {
        build_args: (env, set) => (
          <MonacoEditor
            value={env || "  # VARIABLE = value\n"}
            onValueChange={(build_args) => set({ build_args })}
            language="key_value"
            readOnly={disabled}
          />
        ),
      },
    },
    {
      label: "密钥参数",
      description: (
        <Group>
          <Text>
            向 docker build 传递密钥。使用 Docker 密钥挂载，避免在最终镜像中暴露这些值。
          </Text>
          <Link
            to="https://docs.rs/komodo_client/latest/komodo_client/entities/build/struct.BuildConfig.html#structfield.secret_args"
            target="_blank"
            className="text-primary"
          >
            查看 Docker 文档。
          </Link>
        </Group>
      ),
      labelExtra: !disabled && <SecretsSearch />,
      fields: {
        secret_args: (env, set) => (
          <MonacoEditor
            value={env || "  # VARIABLE = value\n"}
            onValueChange={(secret_args) => set({ secret_args })}
            language="key_value"
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
              <Group gap="xs">
                <Text>向 docker build 传递额外参数。</Text>
                <Text
                  className="hover-underline"
                  fw="bold"
                  component={Link}
                  to="https://docs.docker.com/reference/cli/docker/buildx/build/"
                  target="_blank"
                >
                  查看 Docker 文档。
                </Text>
              </Group>
            }
          >
            {!disabled && (
              <AddExtraArg
                type="Build"
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
      label: "标签",
      description: "通过 --labels 为镜像添加标签。",
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
  ];

  if (mode === undefined) {
    groups = {
      "": [builderGroup, chooseMode],
    };
  } else if (mode === "Files On Server") {
    groups = {
      "": [
        builderGroup,
        versionGroup,
        {
          label: "文件",
          fields: {
            build_path: {
              description: `设置运行 docker build 命令时的工作目录。可使用绝对路径，或相对于 $PERIPHERY_BUILD_DIR/${build.name} 的路径`,
              placeholder: "/path/to/folder",
            },
            dockerfile_path: {
              description:
                "Dockerfile 路径，相对于构建路径。",
              placeholder: "Dockerfile",
            },
          },
        },
        ...generalCommon,
      ],
      advanced,
    };
  } else if (mode === "Git Repo") {
    const repoLinked = !!(update.linked_repo ?? config.linked_repo);
    groups = {
      "": [
        builderGroup,
        versionGroup,
        {
          label: "来源",
          contentHidden: !show.git,
          actions: (
            <ShowHideButton
              show={show.git}
              setShow={(git) => setShow({ ...show, git })}
            />
          ),
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
                  git_account: (account, set) => (
                    <AccountSelectorConfig
                      id={update.builder_id ?? config.builder_id ?? undefined}
                      type="Builder"
                      accountType="git"
                      provider={update.git_provider ?? config.git_provider}
                      selected={account}
                      onSelect={(git_account) => set({ git_account })}
                      disabled={disabled}
                      placeholder="无"
                    />
                  ),
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
                }
              : {}),
          },
        },
        {
          label: "文件",
          fields: {
            build_path: {
              description: (
                <>
                  运行 docker build 的目录，{" "}
                  <b>相对于代码仓库根目录。</b>
                </>
              ),
              placeholder: "path/to/folder",
            },
            dockerfile_path: {
              description:
                "Dockerfile 路径，相对于构建路径。",
              placeholder: "Dockerfile",
            },
          },
        },
        ...generalCommon,
        {
          label: "Webhook",
          description: `复制此处的 Webhook 地址，并在兼容 ${webhookIntegration} 的代码托管平台中配置向 Komodo 发送 Webhook`,
          contentHidden: !show.webhooks,
          actions: (
            <ShowHideButton
              show={show.webhooks}
              setShow={(webhooks) => setShow({ ...show, webhooks })}
            />
          ),
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
            ["Build" as any]: () =>
              (update.branch ?? config.branch) && (
                <CopyWebhookUrl
                  label="Webhook 地址 - 构建"
                  integration={webhookIntegration}
                  path={`/build/${idOrName === "Id" ? id : encodeURIComponent(name ?? "...")}`}
                />
              ),
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
        builderGroup,
        versionGroup,
        {
          label: "Dockerfile",
          description: "在此管理 Dockerfile 内容。",
          contentHidden: !show.file,
          actions: (
            <ShowHideButton
              show={show.file}
              setShow={(file) => setShow({ ...show, file })}
            />
          ),
          fields: {
            dockerfile: (dockerfile, set) => {
              const show_default =
                !dockerfile &&
                update.dockerfile === undefined &&
                !(update.repo ?? config.repo);
              return (
                <Stack>
                  <SecretsSearch />
                  <MonacoEditor
                    value={
                      show_default
                        ? DEFAULT_BUILD_DOCKERFILE_CONTENTS
                        : dockerfile
                    }
                    onValueChange={(dockerfile) => set({ dockerfile })}
                    language="dockerfile"
                    readOnly={disabled}
                  />
                </Stack>
              );
            },
          },
        },
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
      onSave={() => mutateAsync({ id, config: update })}
      groups={groups}
      fileContentsLanguage="dockerfile"
    />
  );
}
