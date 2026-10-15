import { displayLabel } from "@/lib/l10n";
import { Anchor, Group, Select, Stack, Text, TextInput } from "@mantine/core";
import { useLocalStorage } from "@mantine/hooks";
import { useState } from "react";
import { Types } from "komodo_client";
import {
  usePermissions,
  useRead,
  useWebhookIdOrName,
  useWebhookIntegrations,
  useWrite,
} from "@/lib/hooks";
import { MonacoEditor } from "mogh_ui";
import { Config, ConfigItem, ConfigSwitch } from "mogh_ui";
import ActionLastRun from "./last-run";
import TimezoneSelector from "@/components/timezone-selector";
import SecretsSearch from "@/components/config/secrets-search";
import WebhookBuilder from "@/components/webhook/builder";
import { LabelledSwitch } from "mogh_ui";
import CopyWebhookUrl from "@/components/webhook/copy-url";
import { useFullAction } from ".";

const ACTION_GIT_PROVIDER = "Action";

export default function ActionConfig({ id }: { id: string }) {
  const [branch, setBranch] = useState("main");
  const { canWrite } = usePermissions({ type: "Action", id });
  const action = useFullAction(id);
  const config = action?.config;
  const name = action?.name;
  const global_disabled =
    useRead("GetCoreInfo", {}).data?.ui_write_disabled ?? false;
  const [update, setUpdate] = useLocalStorage<Partial<Types.ActionConfig>>({
    key: `action-${id}-update-v1`,
    defaultValue: {},
  });
  const { mutateAsync } = useWrite("UpdateAction");
  const { integrations } = useWebhookIntegrations();
  const [idOrName] = useWebhookIdOrName();

  if (!config) return null;

  const disabled = global_disabled || !canWrite;
  const webhookIntegration = integrations.Action ?? "Github";

  return (
    <Config
      disabled={disabled}
      original={config}
      update={update}
      setUpdate={setUpdate}
      onSave={async () => {
        await mutateAsync({ id, config: update });
      }}
      groups={{
        "": [
          {
            label: "操作文件",
            description: "在此管理操作文件内容。",
            fields: {
              file_contents(value, set) {
                return (
                  <Stack>
                    <Group justify="space-between">
                      <SecretsSearch />
                      <Group visibleFrom="lg">
                        <Text c="dimmed">文档</Text>
                        {["read", "execute", "write"].map((api) => (
                          <Anchor
                            key={api}
                            href={`https://docs.rs/komodo_client/latest/komodo_client/api/${api}/index.html`}
                            target="_blank"
                          >
                            {api}
                          </Anchor>
                        ))}
                      </Group>
                    </Group>
                    <MonacoEditor
                      value={value}
                      onValueChange={(file_contents) => set({ file_contents })}
                      language="typescript"
                      readOnly={disabled}
                    />
                    <ActionLastRun id={id} />
                  </Stack>
                );
              },
            },
          },
          {
            label: "参数",
            description: "管理操作文件的默认参数。",
            fields: {
              arguments(args, set) {
                const format =
                  update.arguments_format ??
                  config.arguments_format ??
                  Types.FileFormat.KeyValue;

                return (
                  <Stack>
                    <Group>
                      <SecretsSearch />
                      <Select
                        placeholder="选择格式"
                        value={format}
                        onChange={(format) =>
                          format &&
                          set({ arguments_format: format as Types.FileFormat })
                        }
                        data={Object.values(Types.FileFormat).map((format) => ({
                          value: format,
                          label: displayLabel(format),
                        }))}
                      />
                    </Group>
                    <MonacoEditor
                      value={args || defaultArguments(format)}
                      onValueChange={(args) => set({ arguments: args })}
                      language={
                        update.arguments_format ??
                        config.arguments_format ??
                        Types.FileFormat.KeyValue
                      }
                      readOnly={disabled}
                    />
                  </Stack>
                );
              },
            },
          },
          {
            label: "告警",
            labelHidden: true,
            fields: {
              failure_alert: {
                description: "操作失败时发送告警",
              },
            },
          },
          {
            label: "计划任务",
            description:
              "使用英文时间表达式或 CRON 配置操作的运行时间。",
            fields: {
              schedule_enabled: (schedule_enabled, set) => (
                <ConfigSwitch
                  label="已启用"
                  value={
                    (update.schedule ?? config.schedule)
                      ? schedule_enabled
                      : false
                  }
                  disabled={disabled || !(update.schedule ?? config.schedule)}
                  onCheckedChange={(schedule_enabled) =>
                    set({ schedule_enabled })
                  }
                />
              ),
              schedule_format: (schedule_format, set) => (
                <ConfigItem
                  label="格式"
                  description="选择英文时间表达式或 CRON 表达式"
                >
                  <Select
                    value={schedule_format}
                    onChange={(schedule_format) =>
                      schedule_format &&
                      set({
                        schedule_format:
                          schedule_format as Types.ScheduleFormat,
                      })
                    }
                    data={Object.values(Types.ScheduleFormat).map((value) => ({ value, label: displayLabel(value) }))}
                    w={{ base: "85%", lg: 400 }}
                  />
                </ConfigItem>
              ),
              schedule: {
                label: "表达式",
                description: (
                  <Stack gap="0" pt="0.2rem">
                    {(update.schedule_format ?? config.schedule_format) ===
                    "Cron" ? (
                      <code>
                        秒 - 分 - 时 - 日 - 月 - 星期
                      </code>
                    ) : (
                      <>
                        <Text size="sm">
                          <code>Run every day at 4:00 pm</code>（每天下午 4 点运行）
                        </Text>
                        <Text size="sm">
                          <code>Run at 21:00 on the 1st and 15th of the month</code>
                          （每月 1 日和 15 日的 21:00 运行）
                        </Text>
                        <Text size="sm">
                          <code>Every Sunday at midnight</code>（每周日午夜运行）
                        </Text>
                      </>
                    )}
                  </Stack>
                ),
                placeholder:
                  (update.schedule_format ?? config.schedule_format) === "Cron"
                    ? "0 0 0 ? * SUN"
                    : "输入英文时间表达式",
              },
              schedule_timezone: (timezone, set) => {
                return (
                  <ConfigItem
                    label="时区"
                    description="为计划表达式选择 IANA 时区。"
                  >
                    <TimezoneSelector
                      timezone={timezone ?? ""}
                      onChange={(schedule_timezone) =>
                        set({ schedule_timezone })
                      }
                      disabled={disabled}
                    />
                  </ConfigItem>
                );
              },
              schedule_alert: {
                description: "计划任务运行时发送告警",
              },
            },
          },
          {
            label: "启动",
            labelHidden: true,
            fields: {
              run_at_startup: {
                label: "启动后运行",
                description:
                  "Komodo Core 启动完成后运行此操作",
              },
            },
          },
          {
            label: "重新加载",
            labelHidden: true,
            fields: {
              reload_deno_deps: {
                label: "重新加载依赖",
                description:
                  "是否让 Deno 重新加载所有依赖。非开发环境通常可保持关闭。",
              },
            },
          },
          {
            label: "Webhook",
            description: `复制此处的 Webhook 地址，并在兼容 ${webhookIntegration} 的代码托管平台中配置向 Komodo 发送 Webhook`,
            fields: {
              ["Builder" as any]: () => (
                <WebhookBuilder
                  gitProvider={ACTION_GIT_PROVIDER}
                  extra={
                    <Group align="end">
                      <TextInput
                        label="监听指定分支？"
                        placeholder="分支"
                        value={branch}
                        onChange={(e) => setBranch(e.target.value)}
                        w={{ base: "100%", sm: 200 }}
                        disabled={branch === "__ANY__"}
                      />
                      <LabelledSwitch
                        label="不检查分支"
                        checked={branch === "__ANY__"}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setBranch("__ANY__");
                          } else {
                            setBranch("main");
                          }
                        }}
                      />
                    </Group>
                  }
                />
              ),
              ["run" as any]: () => (
                <CopyWebhookUrl
                  label="Webhook 地址 - 运行"
                  integration={webhookIntegration}
                  path={`/action/${idOrName === "Id" ? id : encodeURIComponent(name ?? "...")}/${branch}`}
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
      }}
    />
  );
}

const defaultArguments = (format: Types.FileFormat) => {
  switch (format) {
    case Types.FileFormat.KeyValue:
      return "# ARG_NAME = value\n";
    case Types.FileFormat.Toml:
      return '# ARG_NAME = "value"\n';
    case Types.FileFormat.Yaml:
      return "# ARG_NAME: value\n";
    case Types.FileFormat.Json:
      return "{}\n";
  }
};
