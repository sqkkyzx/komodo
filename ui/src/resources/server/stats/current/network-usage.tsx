import { InfoCard } from "mogh_ui";
import { Group, Stack, Text } from "@mantine/core";
import { Types } from "komodo_client";
import { fmtRateBytes } from "mogh_ui";

export default function ServerNetworkUsage({
  stats,
}: {
  stats: Types.SystemStats | undefined;
}) {
  return (
    <InfoCard title="网络使用情况" w={{ base: "100%", lg: 300 }} gap="xs">
      <Stack gap="0">
        <Group justify="space-between">
          <Text>入站</Text>
          <Text>{fmtRateBytes(stats?.network_ingress_bytes ?? 0)}</Text>
        </Group>
        <Group justify="space-between">
          <Text>出站</Text>
          <Text>{fmtRateBytes(stats?.network_egress_bytes ?? 0)}</Text>
        </Group>
      </Stack>
    </InfoCard>
  );
}
