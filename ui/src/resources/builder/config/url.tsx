import { usePermissions, useRead, useWrite } from "@/lib/hooks";
import { Config } from "mogh_ui";
import { useLocalStorage } from "@mantine/hooks";
import { Types } from "komodo_client";

export default function UrlBuilderConfig({ id }: { id: string }) {
  const { canWrite } = usePermissions({ type: "Builder", id });
  const config = useRead("GetBuilder", { builder: id }).data?.config;

  const [update, setUpdate] = useLocalStorage<Partial<Types.UrlBuilderConfig>>({
    key: `url-builder-${id}-update-v1`,
    defaultValue: {},
  });
  const { mutateAsync } = useWrite("UpdateBuilder");

  if (!config) return null;

  const disabled = !canWrite;
  const params = config.params as Types.UrlBuilderConfig;
  const address = update.address ?? params.address;
  const tls_address = !!address && !address.startsWith("ws://");

  return (
    <Config
      disabled={disabled}
      original={params}
      update={update}
      setUpdate={setUpdate}
      onSave={async () => {
        await mutateAsync({ id, config: { type: "Url", params: update } });
      }}
      groups={{
        "": [
          {
            label: "常规",
            labelHidden: true,
            fields: {
              address: {
                description: "Periphery 代理地址",
                placeholder: "wss://periphery:8120",
              },
            },
          },
          {
            label: "连接",
            labelHidden: true,
            fields: {
              periphery_public_key: {
                label: "Periphery 公钥",
                description:
                  "若填写此项，需将对应私钥设置为 Periphery 的 private_key。使用 Periphery 主动连接 Core 时，必须填写此项或在 Core 中配置 periphery_public_key。",
                placeholder: "custom-public-key",
              },
              insecure_tls: {
                hidden: !tls_address,
                description: "跳过 Periphery 的 TLS 证书验证。",
              },
            },
          },
        ],
      }}
    />
  );
}
