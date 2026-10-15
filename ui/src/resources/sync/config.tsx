import { displayLabel } from "@/lib/l10n";
import { AccountSelectorConfig } from "@/components/config/account-selector";
import LinkedRepo from "@/components/config/linked-repo";
import { ProviderSelectorConfig } from "@/components/config/provider-selector";
import { MonacoEditor } from "mogh_ui";
import WebhookBuilder from "@/components/webhook/builder";
import CopyWebhookUrl from "@/components/webhook/copy-url";
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
  ConfigItem,
  ConfigList,
  ConfigSwitch,
} from "mogh_ui";
import { ShowHideButton } from "mogh_ui";
import { Select, Text } from "@mantine/core";
import { useLocalStorage } from "@mantine/hooks";
import { Types } from "komodo_client";
import { ReactNode } from "react";
import { useFullResourceSync } from ".";
import TagMultiSelector from "@/components/tags/multi-selector";

type SyncMode = "UI Defined" | "Files On Server" | "Git Repo" | undefined;
const SYNC_MODES = ["UI Defined", "Files On Server", "Git Repo"] as const;

function getSyncMode(
  update: Partial<Types.ResourceSyncConfig>,
  config: Types.ResourceSyncConfig,
): SyncMode {
  if (update.files_on_host ?? config.files_on_host) return "Files On Server";
  if (
    (update.repo ?? config.repo) ||
    (update.linked_repo ?? config.linked_repo)
  )
    return "Git Repo";
  if (update.file_contents ?? config.file_contents) return "UI Defined";
  return undefined;
}

export default function ResourceSyncConfig({
  id,
  titleOther,
}: {
  id: string;
  titleOther: ReactNode;
}) {
  const [show, setShow] = useLocalStorage({
    key: `sync-${id}-show`,
    defaultValue: {
      file: true,
      git: true,
      webhooks: true,
    },
  });
  const { canWrite } = usePermissions({ type: "ResourceSync", id });
  const sync = useFullResourceSync(id);
  const config = sync?.config;
  const name = sync?.name;
  const coreInfo = useRead("GetCoreInfo", {}).data;
  const globalDisabled = coreInfo?.ui_write_disabled ?? false;
  const enableFancyToml = coreInfo?.enable_fancy_toml ?? false;
  const [update, setUpdate] = useLocalStorage<
    Partial<Types.ResourceSyncConfig>
  >({
    key: `sync-${id}-update-v1`,
    defaultValue: {},
  });
  const { mutateAsync } = useWrite("UpdateResourceSync");
  const { getIntegration } = useWebhookIntegrations();
  const [idOrName] = useWebhookIdOrName();

  if (!config) return null;

  const disabled = globalDisabled || !canWrite;

  const gitProvider = update.git_provider ?? config.git_provider;
  const webhookIntegration = getIntegration(gitProvider);

  const mode = getSyncMode(update, config);
  const managed = update.managed ?? config.managed ?? false;

  const setMode = (mode: SyncMode) => {
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
          "# Initialize the sync to import your current resources.\n",
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

  let groups: ConfigProps<Types.ResourceSyncConfig>["groups"] = {};

  const chooseMode: ConfigGroupArgs<Types.ResourceSyncConfig> = {
    label: "选择模式",
    labelHidden: true,
    fields: {
      file_contents: () => {
        return (
          <ConfigItem
            label="选择模式"
            description="选择在界面中编辑文件、使用服务器上的文件，或从 Git 仓库拉取。"
          >
            <Select
              w="fit-content"
              placeholder="选择模式"
              value={mode}
              onChange={(mode) => mode && setMode(mode as SyncMode)}
              data={SYNC_MODES.map((value) => ({ value, label: displayLabel(value) }))}
              disabled={disabled}
            />
          </ConfigItem>
        );
      },
    },
  };

  const generalCommon: ConfigGroupArgs<Types.ResourceSyncConfig> = {
    label: "常规",
    fields: {
      delete: (delete_mode, set) => {
        return (
          <ConfigSwitch
            label="删除未匹配资源"
            description="执行时会删除资源文件中未包含的资源。仅在通过单个资源同步管理全部资源时使用。"
            value={managed || delete_mode}
            onCheckedChange={(delete_mode) => set({ delete: delete_mode })}
            disabled={disabled || managed}
          />
        );
      },
      managed: {
        label: "托管模式",
        description:
          "启用托管模式及“提交”按钮。“提交”与“执行”的方向相反，会将界面中的配置更新写回同步文件。",
      },
    },
  };

  const includeToggles: ConfigGroupArgs<Types.ResourceSyncConfig> = {
    label: "包含内容",
    fields: {
      include_resources: {
        label: "同步资源",
        description: "同步服务器、应用栈等资源。",
      },
      include_variables: {
        label: "同步变量",
        description: "同步变量。",
      },
      include_user_groups: {
        label: "同步用户组",
        description: "同步用户组。",
      },
    },
  };

  const includeResources = update.include_resources ?? config.include_resources;
  const matchTags: ConfigGroupArgs<Types.ResourceSyncConfig> = {
    label: "匹配标签",
    description: "仅同步匹配全部所选标签的资源。",
    fields: {
      match_tags: (values, set) => {
        return (
          <TagMultiSelector
            value={values ?? []}
            onChange={(match_tags) => set({ match_tags })}
            disabled={disabled || !includeResources}
            useName
            canCreate
          />
        );
      },
    },
  };

  const pendingAlerts: ConfigGroupArgs<Types.ResourceSyncConfig> = {
    label: "告警",
    fields: {
      pending_alert: {
        label: "待同步告警",
        description:
          "资源同步存在待处理变更时，通过告警器发送消息",
      },
    },
  };

  if (mode === undefined) {
    groups = {
      "": [chooseMode],
    };
  } else if (mode === "Files On Server") {
    groups = {
      "": [
        {
          label: "常规",
          fields: {
            resource_path: (values, set) => (
              <ConfigList
                label="资源路径"
                addLabel="添加路径"
                description="添加要同步的 .toml 文件或文件夹，路径相对于 /syncs/{sync_name}。"
                field="resource_path"
                values={values ?? []}
                set={set}
                disabled={disabled}
                placeholder="输入资源路径"
              />
            ),
            ...generalCommon.fields,
          },
        },
        matchTags,
        includeToggles,
        pendingAlerts,
      ],
    };
  } else if (mode === "Git Repo") {
    const repoLinked = !!(update.linked_repo ?? config.linked_repo);
    const sourceConfig: ConfigGroupArgs<Types.ResourceSyncConfig> = {
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
              git_provider: (provider: string | undefined, set) => {
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
              git_account: (value: string | undefined, set) => {
                return (
                  <AccountSelectorConfig
                    accountType="git"
                    type="None"
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
                description: "选择自定义分支，默认为 main。",
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
    };
    const webhooksConfig: ConfigGroupArgs<Types.ResourceSyncConfig> = {
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
        ["Builder" as any]: () => <WebhookBuilder gitProvider={gitProvider} />,
        ["Refresh" as any]: () =>
          (update.branch ?? config.branch) && (
            <CopyWebhookUrl
              label="Webhook 地址 - 刷新待处理变更"
              description="触发待同步缓存更新。"
              integration={webhookIntegration}
              path={`/sync/${idOrName === "Id" ? id : encodeURIComponent(name ?? "...")}/refresh`}
            />
          ),
        ["Sync" as any]: () =>
          (update.branch ?? config.branch) && (
            <CopyWebhookUrl
              label="Webhook 地址 - 执行同步"
              description="触发同步执行。"
              integration={webhookIntegration}
              path={`/sync/${idOrName === "Id" ? id : encodeURIComponent(name ?? "...")}/sync`}
            />
          ),
        webhook_enabled: true,
        webhook_secret: {
          description:
            "为此资源设置自定义 Webhook 密钥，或使用全局默认值。",
          placeholder: "输入自定义密钥",
        },
      },
    };
    groups = {
      "": [
        sourceConfig,
        {
          label: "常规",
          fields: {
            resource_path: (values, set) => (
              <ConfigList
                label="资源路径"
                addLabel="添加路径"
                description={
                  <>
                    添加要同步的 .toml 文件或文件夹，{" "}
                    <b>相对于代码仓库根目录。</b>
                  </>
                }
                field="resource_path"
                values={values ?? []}
                set={set}
                disabled={disabled}
                placeholder="输入资源路径"
              />
            ),
            ...generalCommon.fields,
          },
        },
        matchTags,
        includeToggles,
        pendingAlerts,
        webhooksConfig,
      ],
    };
  } else if (mode === "UI Defined") {
    groups = {
      "": [
        {
          label: "资源文件",
          description:
            "在此管理资源文件内容，也可选择 Git 仓库或主机上的文件。",
          actions: (
            <ShowHideButton
              show={show.file}
              setShow={(file) => setShow((show) => ({ ...show, file }))}
            />
          ),
          contentHidden: !show.file,
          fields: {
            file_contents: (file_contents, set) => {
              return (
                <MonacoEditor
                  value={
                    file_contents ||
                    "# Initialize the sync to import your current resources.\n"
                  }
                  onValueChange={(file_contents) => set({ file_contents })}
                  language="fancy_toml"
                  enableFancyToml={enableFancyToml}
                  readOnly={disabled}
                />
              );
            },
          },
        },
        generalCommon,
        matchTags,
        includeToggles,
        pendingAlerts,
      ],
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
      fileContentsLanguage="fancy_toml"
      enableFancyToml={enableFancyToml}
    />
  );
}
