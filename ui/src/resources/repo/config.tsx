import {
  usePermissions,
  useRead,
  useWebhookIdOrName,
  useWebhookIntegrations,
  useWrite,
} from "@/lib/hooks";
import { Config, ConfigItem, ConfigList } from "mogh_ui";
import { useLocalStorage } from "@mantine/hooks";
import { Types } from "komodo_client";
import ResourceLink from "@/resources/link";
import ResourceSelector from "@/resources/selector";
import { Group, Stack, Text } from "@mantine/core";
import { ProviderSelectorConfig } from "@/components/config/provider-selector";
import { AccountSelectorConfig } from "@/components/config/account-selector";
import SecretsSearch from "@/components/config/secrets-search";
import { MonacoEditor } from "mogh_ui";
import SystemCommand from "@/components/config/system-command";
import { ReactNode } from "react";
import CopyWebhookUrl from "@/components/webhook/copy-url";
import WebhookBuilder from "@/components/webhook/builder";
import { useFullRepo } from ".";

export default function RepoConfig({
  id,
  titleOther,
}: {
  id: string;
  titleOther?: ReactNode;
}) {
  const { canWrite } = usePermissions({ type: "Repo", id });
  const repo = useFullRepo(id);
  const config = repo?.config;
  const name = repo?.name;
  const global_disabled =
    useRead("GetCoreInfo", {}).data?.ui_write_disabled ?? false;
  const [update, setUpdate] = useLocalStorage<Partial<Types.RepoConfig>>({
    key: `repo-${id}-update-v1`,
    defaultValue: {},
  });
  const { mutateAsync } = useWrite("UpdateRepo");
  const { getIntegration } = useWebhookIntegrations();
  const [idOrName] = useWebhookIdOrName();

  if (!config) return null;

  const disabled = global_disabled || !canWrite;

  const gitProvider = update.git_provider ?? config.git_provider;
  const webhookIntegration = getIntegration(gitProvider);

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
            label: "服务器",
            labelHidden: true,
            fields: {
              server_id: (server_id, set) => {
                return (
                  <ConfigItem
                    label={
                      server_id ? (
                        <Group fz="h3">
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
                    description="选择用于克隆的服务器，可选。"
                  >
                    <ResourceSelector
                      type="Server"
                      selected={server_id}
                      onSelect={(server_id) => set({ server_id })}
                      disabled={disabled}
                      clearable
                    />
                  </ConfigItem>
                );
              },
            },
          },
          {
            label: "构建器",
            labelHidden: true,
            fields: {
              builder_id: (builder_id, set) => {
                return (
                  <ConfigItem
                    label={
                      builder_id ? (
                        <Group fz="h3">
                          构建器：
                          <ResourceLink
                            type="Builder"
                            id={builder_id}
                            fz="h3"
                            iconSize="1.2rem"
                          />
                        </Group>
                      ) : (
                        "选择构建器"
                      )
                    }
                    description="选择用于构建的构建器，可选。"
                  >
                    <ResourceSelector
                      type="Builder"
                      selected={builder_id}
                      onSelect={(builder_id) => set({ builder_id })}
                      disabled={disabled}
                      clearable
                    />
                  </ConfigItem>
                );
              },
            },
          },
          {
            label: "来源",
            fields: {
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
                  accountType="git"
                  type="Builder"
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
                description: "选择自定义分支，默认为 main。",
              },
              commit: {
                label: "提交哈希",
                placeholder: "输入提交哈希",
                description:
                  "可选。克隆分支后切换到指定提交。",
              },
            },
          },
          {
            label: "路径",
            labelHidden: true,
            fields: {
              path: {
                label: "克隆路径",
                placeholder: "/clone/path/on/host",
                description: (
                  <Stack gap="0">
                    <Text>
                      指定主机上用于克隆代码仓库的文件夹。
                    </Text>
                    <Text>
                      若为 <b>相对路径</b> （不以 / 开头），则相对于{" "}
                      <b>{"$root_directory/repos/" + repo.name}</b>
                    </Text>
                  </Stack>
                ),
              },
            },
          },
          {
            label: "环境变量",
            description:
              "运行 on_clone / on_pull 前，将这些变量写入指定路径的 .env 格式文件。",
            fields: {
              environment: (env, set) => (
                <Stack gap="xs">
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
              env_file_path: {
                description:
                  "要写入的文件路径，相对于代码仓库根目录。",
                placeholder: ".env",
              },
              // skip_secret_interp: true,
            },
          },
          {
            label: "克隆后操作",
            description:
              "克隆代码仓库后执行 Shell 命令。Cwd 相对于代码仓库根目录。",
            fields: {
              on_clone: (value, set) => (
                <SystemCommand
                  value={value}
                  set={(value) => set({ on_clone: value })}
                  disabled={disabled}
                />
              ),
            },
          },
          {
            label: "拉取后操作",
            description:
              "拉取代码仓库后执行 Shell 命令。Cwd 相对于代码仓库根目录。",
            fields: {
              on_pull: (value, set) => (
                <SystemCommand
                  value={value}
                  set={(value) => set({ on_pull: value })}
                  disabled={disabled}
                />
              ),
            },
          },
          {
            label: "Webhook",
            description: `复制此处的 Webhook 地址，并在兼容 ${webhookIntegration} 的代码托管平台中配置向 Komodo 发送 Webhook`,
            fields: {
              ["Guard" as any]: () => {
                if (update.branch ?? config.branch) {
                  return null;
                }
                return (
                  <ConfigItem label="配置分支">
                    <Text>
                      需先配置分支，Webhook 才能生效。
                    </Text>
                  </ConfigItem>
                );
              },
              ["Builder" as any]: () => (
                <WebhookBuilder gitProvider={gitProvider} />
              ),
              ["Pull" as any]: () => (
                <CopyWebhookUrl
                  label="Webhook 地址 - 拉取"
                  integration={webhookIntegration}
                  path={`/repo/${idOrName === "Id" ? id : encodeURIComponent(name ?? "...")}/pull`}
                />
              ),
              ["Clone" as any]: () => (
                <CopyWebhookUrl
                  label="Webhook 地址 - 克隆"
                  integration={webhookIntegration}
                  path={`/repo/${idOrName === "Id" ? id : encodeURIComponent(name ?? "...")}/clone`}
                />
              ),
              ["Build" as any]: () => (
                <CopyWebhookUrl
                  label="Webhook 地址 - 构建"
                  integration={webhookIntegration}
                  path={`/repo/${idOrName === "Id" ? id : encodeURIComponent(name ?? "...")}/build`}
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
        ],
      }}
    />
  );
}
