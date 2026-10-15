import { usePermissions, useRead, useWrite } from "@/lib/hooks";
import { useFullServer } from ".";
import { ReactNode, useEffect, useState } from "react";
import { Types } from "komodo_client";
import { useLocalStorage } from "@mantine/hooks";
import { Config, ConfigInput, ConfigList } from "mogh_ui";
import { ConfirmButton } from "mogh_ui";
import { ICONS } from "@/lib/icons";
import { Group } from "@mantine/core";
import { useIsServerAvailable } from "./hooks";
import ConfigMaintenanceWindows from "@/components/maintenance-windows";

export default function ServerConfig({
  id,
  titleOther,
}: {
  id: string;
  titleOther: ReactNode;
}) {
  const globalDisabled =
    useRead("GetCoreInfo", {}).data?.ui_write_disabled ?? false;
  const { canWrite } = usePermissions({ type: "Server", id });
  const isAvailable = useIsServerAvailable(id);

  const server = useFullServer(id);
  const config = server?.config;
  const [publicKey, setPublicKey] = useState("");

  useEffect(() => {
    if (server?.info?.public_key) {
      setPublicKey(server.info.public_key);
    }
  }, [server?.info?.public_key]);
  const [update, setUpdate] = useLocalStorage<Partial<Types.ServerConfig>>({
    key: `server-${id}-update-v1`,
    defaultValue: {},
  });

  const { mutateAsync } = useWrite("UpdateServer");
  const { mutate: updatePublicKey, isPending: updatePublicPending } = useWrite(
    "UpdateServerPublicKey",
  );
  const { mutate: rotate, isPending: rotatePending } =
    useWrite("RotateServerKeys");

  if (!config) return null;

  const disabled = globalDisabled || !canWrite;
  const address = update.address ?? config.address;
  const tlsAddress = !!address && !address.startsWith("ws://");

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
            label: "已启用",
            labelHidden: true,
            fields: {
              enabled: {
                description:
                  "是否连接此主机并在离线时告警。禁用后，关联资源的状态也将变为“未知”。",
              },
            },
          },
          {
            label: "认证",
            labelHidden: true,
            fields: {
              enabled: () => (
                <ConfigInput
                  label="Periphery 公钥"
                  description="若填写此项，需将对应私钥设置为 Periphery 的 private_key。使用 Periphery 主动连接 Core 时，必须填写此项或在 Core 中配置 periphery_public_key。"
                  placeholder="custom-public-key"
                  value={publicKey}
                  onValueChange={(publicKey) => setPublicKey(publicKey)}
                  inputRight={
                    !disabled && (
                      <Group>
                        <ConfirmButton
                          icon={<ICONS.Save size="1rem" />}
                          maw="120px"
                          onClick={() =>
                            updatePublicKey({
                              server: id,
                              public_key: publicKey,
                            })
                          }
                          loading={updatePublicPending}
                          disabled={publicKey === server?.info?.public_key}
                        >
                          保存
                        </ConfirmButton>
                        <ConfirmButton
                          icon={<ICONS.RotateKey size="1rem" />}
                          maw="120px"
                          onClick={() => rotate({ server: id })}
                          loading={rotatePending}
                          disabled={!isAvailable}
                        >
                          轮换
                        </ConfirmButton>
                      </Group>
                    )
                  }
                  disabled={disabled}
                />
              ),
              auto_rotate_keys: {
                description:
                  "执行 RotateAllServerKeys 时也轮换此服务器的密钥。",
              },
            },
          },
          {
            label: "地址",
            labelHidden: true,
            fields: {
              address: {
                description:
                  "使用 Core 主动连接 Periphery 时，指定网络中的 Periphery 地址。",
                placeholder: "12.34.56.78:8120",
              },
              insecure_tls: {
                hidden: !tlsAddress,
                description: "跳过 Periphery 的 TLS 证书验证。",
              },
              external_address: {
                description:
                  "可选。若容器链接使用的服务器地址与上述地址不同，可在此指定。",
                placeholder: "my.server.int",
              },
              region: {
                description:
                  "可选。为服务器设置区域，便于分组显示。",
                placeholder: "配置区域",
              },
            },
          },
          {
            label: "磁盘",
            labelHidden: true,
            fields: {
              ignore_mounts: (values, set) => (
                <ConfigList
                  description="在此过滤不希望出现在服务器统计中的磁盘挂载点。"
                  label="忽略磁盘"
                  field="ignore_mounts"
                  values={values ?? []}
                  set={set}
                  disabled={disabled}
                  placeholder="/path/to/disk"
                />
              ),
            },
          },
          {
            label: "监控",
            labelHidden: true,
            fields: {
              stats_monitoring: {
                label: "系统统计监控",
                description:
                  "是否保存 CPU、内存和磁盘使用率的历史数据。",
              },
            },
          },
          {
            label: "清理",
            labelHidden: true,
            fields: {
              auto_prune: {
                label: "自动清理镜像",
                description:
                  "是否每天 UTC 00:00 清理未使用的镜像",
              },
            },
          },
        ],
        alerts: [
          {
            label: "无法连接",
            labelHidden: true,
            fields: {
              send_unreachable_alerts: {
                description:
                  "无法连接 Periphery 代理时发送告警。",
              },
            },
          },
          {
            label: "版本",
            labelHidden: true,
            fields: {
              send_version_mismatch_alerts: {
                label: "发送版本不匹配告警",
                description:
                  "Periphery 与 Core 版本不同时发送告警。",
              },
            },
          },
          {
            label: "CPU",
            labelHidden: true,
            fields: {
              send_cpu_alerts: {
                label: "发送 CPU 告警",
                description:
                  "CPU 使用率超过设定阈值时发送告警。",
              },
              cpu_warning: {
                description:
                  "CPU 使用率超过此阈值时发送“警告”告警",
              },
              cpu_critical: {
                description:
                  "CPU 使用率超过此阈值时发送“严重”告警",
              },
            },
          },
          {
            label: "内存",
            labelHidden: true,
            fields: {
              send_mem_alerts: {
                label: "发送内存告警",
                description:
                  "内存使用率超过设定阈值时发送告警。",
              },
              mem_warning: {
                label: "内存警告阈值",
                description:
                  "内存使用率超过此阈值时发送“警告”告警",
              },
              mem_critical: {
                label: "内存严重阈值",
                description:
                  "内存使用率超过此阈值时发送“严重”告警",
              },
            },
          },
          {
            label: "磁盘",
            labelHidden: true,
            fields: {
              send_disk_alerts: {
                description:
                  "任一已挂载磁盘的使用率超过设定阈值时发送告警。",
              },
              disk_warning: {
                description:
                  "磁盘使用率超过此阈值时发送“警告”告警",
              },
              disk_critical: {
                description:
                  "磁盘使用率超过此阈值时发送“严重”告警",
              },
            },
          },
          {
            label: "维护",
            description: (
              <>
                配置维护窗口，在计划维护期间暂停告警。维护窗口生效时，不发送此服务器的告警。
              </>
            ),
            fields: {
              maintenance_windows: (values, set) => {
                return (
                  <ConfigMaintenanceWindows
                    windows={values ?? []}
                    onUpdate={(maintenance_windows) =>
                      set({ maintenance_windows })
                    }
                    disabled={disabled}
                  />
                );
              },
            },
          },
        ],
      }}
    />
  );
}
