import { usePermissions, useRead, useWrite } from "@/lib/hooks";
import { ReactNode } from "react";
import { useFullSwarm } from ".";
import { useLocalStorage } from "@mantine/hooks";
import { Types } from "komodo_client";
import { Config, ConfigItem, ConfigList } from "mogh_ui";
import { ActionIcon, Button, Group } from "@mantine/core";
import ResourceSelector from "@/resources/selector";
import { ICONS } from "@/lib/icons";
import ConfigMaintenanceWindows from "@/components/maintenance-windows";

export default function SwarmConfig({
  id,
  titleOther,
}: {
  id: string;
  titleOther: ReactNode;
}) {
  const { canWrite } = usePermissions({ type: "Swarm", id });
  const swarm = useFullSwarm(id);
  const config = swarm?.config;
  const globalDisabled =
    useRead("GetCoreInfo", {}).data?.ui_write_disabled ?? false;
  const [update, setUpdate] = useLocalStorage<Partial<Types.SwarmConfig>>({
    key: `swarm-${id}-update-v1`,
    defaultValue: {},
  });
  const { mutateAsync } = useWrite("UpdateSwarm");

  if (!config) return null;

  const disabled = globalDisabled || !canWrite;

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
            label: "管理节点",
            labelHidden: true,
            fields: {
              server_ids: (serverIds, set) => {
                return (
                  <ConfigItem
                    label="管理节点"
                    description="选择已作为管理节点加入集群的服务器。"
                    gap="sm"
                  >
                    {serverIds?.map((serverId, index) => {
                      return (
                        <Group
                          key={index}
                          gap="xs"
                          w={{ base: "100%", lg: 400 }}
                          justify="space-between"
                          wrap="nowrap"
                        >
                          <ResourceSelector
                            type="Server"
                            excludeIds={serverIds}
                            selected={serverId}
                            onSelect={(server_id) =>
                              set({
                                server_ids: [
                                  ...serverIds.map((id, i) =>
                                    i === index ? server_id : id,
                                  ),
                                ],
                              })
                            }
                            disabled={disabled}
                            targetProps={{ w: "90%", maw: "" }}
                            clearable={false}
                          />
                          {!disabled && (
                            <ActionIcon variant="filled" color="red">
                              <ICONS.Remove
                                size="1rem"
                                onClick={() =>
                                  set({
                                    server_ids: [
                                      ...serverIds?.filter(
                                        (_, i) => i !== index,
                                      ),
                                    ],
                                  })
                                }
                              />
                            </ActionIcon>
                          )}
                        </Group>
                      );
                    })}
                    {!disabled && (
                      <Button
                        onClick={() =>
                          set({
                            server_ids: [...(serverIds ?? []), ""],
                          })
                        }
                        leftSection={<ICONS.Add size="1rem" />}
                        w={{ base: "100%", lg: 400 }}
                      >
                        添加服务器
                      </Button>
                    )}
                  </ConfigItem>
                );
              },
            },
          },
          {
            label: "告警",
            labelHidden: true,
            fields: {
              send_unhealthy_alerts: {
                description: "集群不健康时发送告警",
              },
              maintenance_windows: (values, set) => {
                return (
                  <ConfigItem
                    label="维护"
                    description={
                      <>
                        配置维护窗口，在计划维护期间暂停告警。维护窗口生效时，不发送此集群的告警。
                      </>
                    }
                  >
                    <ConfigMaintenanceWindows
                      windows={values ?? []}
                      onUpdate={(maintenance_windows) =>
                        set({ maintenance_windows })
                      }
                      disabled={disabled}
                    />
                  </ConfigItem>
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
        ],
      }}
    />
  );
}
