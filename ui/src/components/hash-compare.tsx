import {
  Badge,
  Box,
  Code,
  Group,
  HoverCard,
  HoverCardProps,
  Stack,
  Text,
} from "@mantine/core";

export interface HashCompareProps extends HoverCardProps {
  /* The last deployed / built / synced hash */
  lastHash: string | undefined;
  lastMessage: string | undefined;
  lastLabel: string | undefined;
  /* The latest hash from the repo source */
  latestHash: string | undefined;
  latestMessage: string | undefined;
}

export default function HashCompare({
  lastHash,
  lastMessage,
  lastLabel = "上次",
  latestHash,
  latestMessage,
  ...props
}: HashCompareProps) {
  const outOfDate =
    !!lastHash && lastHash.slice(0, 8) !== latestHash?.slice(0, 8);
  return (
    <HoverCard position="bottom-start" {...props}>
      <HoverCard.Target>
        <Box
          px="sm"
          py="0.2rem"
          bdrs="sm"
          style={{
            borderColor: outOfDate
              ? "var(--mantine-color-yellow-7)"
              : "var(--mantine-color-accent-border-1)",
            borderStyle: "solid",
            borderWidth: "1px",
            cursor: "pointer",
          }}
        >
          {lastHash ? lastLabel : "最新"}: {lastHash || latestHash}
        </Box>
      </HoverCard.Target>
      <HoverCard.Dropdown>
        <Stack>
          <Stack gap="xs">
            <Group gap="xs">
              <Badge color="accent.9">提交说明</Badge>
              <Text c="dimmed">{lastHash}</Text>
            </Group>
            <Code maw="calc(100vh - 150px)" style={{ overflow: "auto" }}>
              {lastMessage || latestMessage}
            </Code>
          </Stack>
          {outOfDate && (
            <Stack gap="xs">
              <Group gap="xs">
                <Badge style={{ borderColor: "var(--mantine-color-yellow-7)" }}>
                  最新
                </Badge>
                <Text c="dimmed">{latestHash}</Text>
              </Group>
              <Code maw="calc(100vh - 150px)" style={{ overflow: "auto" }}>
                {latestMessage}
              </Code>
            </Stack>
          )}
        </Stack>
      </HoverCard.Dropdown>
    </HoverCard>
  );
}
