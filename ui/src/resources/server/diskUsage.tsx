import { Group, Stack, Text } from "@mantine/core";
import { Types } from "komodo_client";
import { useServerThresholds } from "@/resources/server/hooks";
import { hexColorByIntention } from "mogh_ui";
import { ICONS } from "@/lib/icons";

export default function ServerDiskUsage({
  id,
  stats,
  withHeader,
}: {
  id: string;
  stats: Types.SystemStats | undefined;
  withHeader?: boolean;
}) {
  const used = stats?.disks?.reduce((acc, d) => acc + (d.used_gb || 0), 0) ?? 0;
  const total =
    stats?.disks?.reduce((acc, d) => acc + (d.total_gb || 0), 0) ?? 0;
  const perc = total > 0 ? (used / total) * 100 : 0;
  const { diskWarning: warning, diskCritical: critical } =
    useServerThresholds(id);
  const intent: "Good" | "Warning" | "Critical" =
    perc < warning ? "Good" : perc < critical ? "Warning" : "Critical";
  return (
    <Stack
      gap="sm"
      className={withHeader ? "bordered-light" : undefined}
      p={withHeader ? "md" : undefined}
      bdrs="md"
    >
      {withHeader && (
        <Group justify="space-between">
          <Text fz="lg">磁盘使用情况</Text>
          <Group gap="xs">
            <Text c="dimmed">总使用率：</Text>
            <Text c={hexColorByIntention(intent)} fz="lg">
              {perc.toFixed(2)}%
            </Text>
            <ICONS.Disk size="1.3rem" />
          </Group>
        </Group>
      )}
      {stats?.disks.map((disk) => (
        <Group
          key={disk.mount}
          justify="space-between"
          className="bordered-light"
          p="sm"
          bdrs="sm"
        >
          <Group>
            <Text c="dimmed">挂载点：</Text>{" "}
            <Text ff="monospace" bg="accent.6" px="xs" bdrs="sm">
              {disk.mount}
            </Text>
          </Group>
          <Text>-</Text>
          <Group gap="0.4rem">
            {disk.used_gb.toFixed(1)} GB <Text c="dimmed">/</Text>{" "}
            {disk.total_gb.toFixed(1)} GB <Text c="dimmed">已使用</Text> (
            {((100 * disk.used_gb) / disk.total_gb).toFixed(1)} %)
          </Group>
        </Group>
      ))}
    </Stack>
  );
}
