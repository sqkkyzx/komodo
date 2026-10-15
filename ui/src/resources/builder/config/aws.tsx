import { MonacoEditor } from "mogh_ui";
import { usePermissions, useRead, useWrite } from "@/lib/hooks";
import { Config, ConfigList } from "mogh_ui";
import { useLocalStorage } from "@mantine/hooks";
import { Types } from "komodo_client";

export default function AwsBuilderConfig({ id }: { id: string }) {
  const { canWrite } = usePermissions({ type: "Builder", id });
  const config = useRead("GetBuilder", { builder: id }).data?.config
    ?.params as Types.AwsBuilderConfig;
  const global_disabled =
    useRead("GetCoreInfo", {}).data?.ui_write_disabled ?? false;
  const [update, setUpdate] = useLocalStorage<Partial<Types.AwsBuilderConfig>>({
    key: `aws-builder-${id}-update-v1`,
    defaultValue: {},
  });
  const { mutateAsync } = useWrite("UpdateBuilder");
  if (!config) return null;

  const disabled = global_disabled || !canWrite;

  return (
    <Config
      disabled={disabled}
      original={config}
      update={update}
      setUpdate={setUpdate}
      onSave={async () => {
        await mutateAsync({ id, config: { type: "Aws", params: update } });
      }}
      groups={{
        "": [
          {
            label: "常规",
            fields: {
              region: {
                description:
                  "配置启动实例的 AWS 区域。",
                placeholder: "输入区域",
              },
              instance_type: {
                description: "选择要启动的实例类型",
                placeholder: "输入实例类型",
              },
              ami_id: {
                description:
                  "创建已安装 Docker 和 Komodo Periphery 的 AMI。",
                placeholder: "输入 AMI ID",
              },
              volume_gb: {
                description: "挂载到实例的磁盘大小。",
                placeholder: "输入大小",
              },
              key_pair_name: {
                description: "为实例绑定密钥对",
                placeholder: "输入密钥对名称",
              },
            },
          },
          {
            label: "网络",
            fields: {
              subnet_id: {
                description: "配置启动实例的子网。",
                placeholder: "输入子网 ID",
              },
              security_group_ids: (values, set) => (
                <ConfigList
                  label="安全组 ID"
                  description="为实例关联安全组。"
                  field="security_group_ids"
                  values={values ?? []}
                  set={set}
                  disabled={disabled}
                  placeholder="输入 ID"
                />
              ),
              assign_public_ip: {
                description:
                  "是否为构建实例分配公网 IP。",
              },
              use_public_ip: {
                description:
                  "是否通过公网 IP 连接实例；关闭时使用内网 IP。",
              },
            },
          },
          {
            label: "用户数据",
            description: "运行脚本初始化实例。",
            fields: {
              user_data: (user_data, set) => {
                return (
                  <MonacoEditor
                    value={user_data}
                    language="shell"
                    onValueChange={(user_data) => set({ user_data })}
                    readOnly={disabled}
                  />
                );
              },
            },
          },
        ],
        additional: [
          {
            label: "连接",
            labelHidden: true,
            fields: {
              periphery_public_key: {
                label: "Periphery 公钥",
                description:
                  "若填写此项，需将对应私钥设置为 Periphery 的 private_key。",
                placeholder: "custom-public-key",
              },
              port: {
                description: "配置连接 Periphery 的端口。",
                placeholder: "输入端口",
              },
              use_https: {
                description: "是否使用 HTTPS 连接 Periphery。",
              },
              insecure_tls: {
                description:
                  "启用 HTTPS 时跳过 Periphery 的 TLS 证书验证。",
              },
            },
          },
        ],
      }}
    />
  );
}
