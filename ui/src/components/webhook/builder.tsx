import {
  useWebhookIdOrName,
  useWebhookIntegrations,
  WebhookIdOrName,
  WebhookIntegration,
} from "@/lib/hooks";
import { ConfigItem, ConfigItemProps } from "mogh_ui";
import { Select, Stack } from "@mantine/core";
import { ReactNode } from "react";

export interface WebhookBuilderProps extends Omit<ConfigItemProps, "children"> {
  gitProvider: string;
  extra?: ReactNode;
}

export default function WebhookBuilder({
  gitProvider,
  extra,
  ...itemProps
}: WebhookBuilderProps) {
  const { setIntegration, getIntegration } = useWebhookIntegrations();
  const [idOrName, setIdOrName] = useWebhookIdOrName();
  return (
    <ConfigItem {...itemProps}>
      <Stack gap="xs">
        <Select
          label="认证方式"
          value={getIntegration(gitProvider)}
          onChange={(integration) =>
            integration &&
            setIntegration(gitProvider, integration as WebhookIntegration)
          }
          data={["Github", "Gitlab"]}
          w={{ base: "100%", sm: 200 }}
        />
        <Select
          label="资源 ID 或名称"
          value={idOrName}
          onChange={(value) => value && setIdOrName(value as WebhookIdOrName)}
          data={[
            { value: "Id", label: "ID" },
            { value: "Name", label: "名称" },
          ]}
          w={{ base: "100%", sm: 200 }}
        />
        {extra}
      </Stack>
    </ConfigItem>
  );
}
