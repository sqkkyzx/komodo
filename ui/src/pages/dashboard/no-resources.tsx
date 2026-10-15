import { useNoResources, useUser } from "@/lib/hooks";
import { ICONS } from "@/lib/icons";
import { Group, Text } from "@mantine/core";

export default function DashboardNoResources() {
  const noResources = useNoResources();
  const user = useUser().data!;
  return (
    noResources && (
      <Group gap="sm" opacity={0.6}>
        <ICONS.Alert size="1rem" />
        <Text fz="lg">
          未找到资源。{" "}
          {user.admin
            ? "请先创建一台服务器。"
            : "请联系管理员获取资源访问权限。"}
        </Text>
      </Group>
    )
  );
}
