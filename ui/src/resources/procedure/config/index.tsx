import { displayLabel } from "@/lib/l10n";
import {
  usePermissions,
  useRead,
  useWebhookIdOrName,
  useWebhookIntegrations,
  useWrite,
} from "@/lib/hooks";
import { Config, ConfigItem, ConfigSwitch } from "mogh_ui";
import { useLocalStorage } from "@mantine/hooks";
import { Types } from "komodo_client";
import { useState } from "react";
import Stage from "./stage";
import { Button, Group, Select, Stack, TextInput } from "@mantine/core";
import { ICONS } from "@/lib/icons";
import TimezoneSelector from "@/components/timezone-selector";
import WebhookBuilder from "@/components/webhook/builder";
import { LabelledSwitch } from "mogh_ui";
import CopyWebhookUrl from "@/components/webhook/copy-url";
import { useFullProcedure } from "..";

const PROCEDURE_GIT_PROVIDER = "Procedure";

export function newStage(next_index: number) {
  return {
    name: `阶段 ${next_index}`,
    enabled: true,
    executions: [defaultEnabledExecution()],
  };
}

export function defaultEnabledExecution(): Types.EnabledExecution {
  return {
    enabled: true,
    execution: {
      type: "None",
      params: {},
    },
  };
}

export default function ProcedureConfig({ id }: { id: string }) {
  const [branch, setBranch] = useState("main");
  const { canWrite } = usePermissions({ type: "Procedure", id });
  const procedure = useFullProcedure(id);
  const config = procedure?.config;
  const name = procedure?.name;
  const global_disabled =
    useRead("GetCoreInfo", {}).data?.ui_write_disabled ?? false;
  const [update, setUpdate] = useLocalStorage<Partial<Types.ProcedureConfig>>({
    key: `procedure-${id}-update-v1`,
    defaultValue: {},
  });
  const { mutateAsync } = useWrite("UpdateProcedure");
  const { integrations } = useWebhookIntegrations();
  const [idOrName] = useWebhookIdOrName();

  if (!config) return null;

  const disabled = global_disabled || !canWrite;
  const webhookIntegration = integrations[PROCEDURE_GIT_PROVIDER] ?? "Github";
  const stages = update.stages || procedure.config?.stages || [];

  const addStage = () =>
    setUpdate((config) => ({
      ...config,
      stages: [...stages, newStage(stages.length + 1)],
    }));

  return (
    <Config
      disabled={disabled}
      original={config}
      update={update}
      setUpdate={setUpdate}
      onSave={() => mutateAsync({ id, config: update })}
      groups={{
        "": [
          {
            label: "阶段",
            description:
              "同一阶段内的任务并行执行，各阶段按顺序执行。",
            fields: {
              stages: (stages, set) => (
                <Stack gap="xl">
                  {stages?.map((stage, index) => (
                    <Stage
                      key={index}
                      stage={stage}
                      setStage={(stage) =>
                        set({
                          stages: stages.map((s, i) =>
                            index === i ? stage : s,
                          ),
                        })
                      }
                      removeStage={() =>
                        set({
                          stages: stages.filter((_, i) => index !== i),
                        })
                      }
                      moveUp={
                        index === 0
                          ? undefined
                          : () =>
                              set({
                                stages: stages.map((stage, i) => {
                                  // Make sure its not the first row
                                  if (i === index && index !== 0) {
                                    return stages[index - 1];
                                  } else if (i === index - 1) {
                                    // Reverse the entry, moving this row "Up"
                                    return stages[index];
                                  } else {
                                    return stage;
                                  }
                                }),
                              })
                      }
                      moveDown={
                        index === stages.length - 1
                          ? undefined
                          : () =>
                              set({
                                stages: stages.map((stage, i) => {
                                  // The index also cannot be the last index, which cannot be moved down
                                  if (
                                    i === index &&
                                    index !== stages.length - 1
                                  ) {
                                    return stages[index + 1];
                                  } else if (i === index + 1) {
                                    // Move the row "Down"
                                    return stages[index];
                                  } else {
                                    return stage;
                                  }
                                }),
                              })
                      }
                      insertAbove={() =>
                        set({
                          stages: [
                            ...stages.slice(0, index),
                            newStage(index + 1),
                            ...stages.slice(index),
                          ],
                        })
                      }
                      insertBelow={() =>
                        set({
                          stages: [
                            ...stages.slice(0, index + 1),
                            newStage(index + 2),
                            ...stages.slice(index + 1),
                          ],
                        })
                      }
                      disabled={disabled}
                    />
                  ))}
                  <Button
                    leftSection={<ICONS.Add size="1rem" />}
                    onClick={addStage}
                    disabled={disabled}
                    w="fit-content"
                  >
                    添加阶段
                  </Button>
                </Stack>
              ),
            },
          },
          {
            label: "告警",
            labelHidden: true,
            fields: {
              failure_alert: {
                description: "流程失败时发送告警",
              },
            },
          },
          {
            label: "计划任务",
            description:
              "使用英文时间表达式或 CRON 配置流程的运行时间。",
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
                        <code>- 每天下午 4 点运行</code>
                        <code>
                          - 每月 1 日和 15 日的 21:00 运行
                        </code>
                        <code>- 每周日午夜运行</code>
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
            label: "Webhook",
            description: `复制此处的 Webhook 地址，并在兼容 ${webhookIntegration} 的代码托管平台中配置向 Komodo 发送 Webhook`,
            fields: {
              ["Builder" as any]: () => (
                <WebhookBuilder
                  gitProvider={PROCEDURE_GIT_PROVIDER}
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
                  path={`/procedure/${idOrName === "Id" ? id : encodeURIComponent(name ?? "...")}/${branch}`}
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
