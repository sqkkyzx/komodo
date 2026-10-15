import { useWebsocketConnected, useWebsocketReconnect } from "@/lib/socket";
import { ActionIcon, Box, HoverCard, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { Circle } from "lucide-react";
import { hexColorByIntention } from "mogh_ui";

export default function WebsocketStatus() {
  const connected = useWebsocketConnected();
  const reconnect = useWebsocketReconnect();
  const onClick = () => {
    reconnect();
    notifications.show({
      message: connected
        ? "已触发 WebSocket 重新连接"
        : "已触发 WebSocket 连接",
      color: "blue",
    });
  };
  const intention = connected ? "Good" : "Critical";
  const color = hexColorByIntention(intention);

  const Target = (
    <ActionIcon variant="subtle" onClick={onClick} size="xl">
      <Circle
        size="1.2rem"
        color={color}
        fill={color}
        style={{ transition: "all 300ms ease" }}
      />
    </ActionIcon>
  );

  return (
    <>
      {/* The hovercard can open unexpectedly on mobile so is hidden */}
      <Box hiddenFrom="sm">{Target}</Box>
      <Box visibleFrom="sm">
        <HoverCard offset={16}>
          <HoverCard.Target>{Target}</HoverCard.Target>
          <HoverCard.Dropdown>
            <Text>WebSocket 状态</Text>
            <Text c="dimmed" fz="sm">
              点击重新连接
            </Text>
          </HoverCard.Dropdown>
        </HoverCard>
      </Box>
    </>
  );
}
