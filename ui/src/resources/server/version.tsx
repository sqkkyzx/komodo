import { useRead } from "@/lib/hooks";
import { useServer } from ".";
import { Group, HoverCard, Text } from "@mantine/core";
import { ICONS } from "@/lib/icons";
import { Types } from "komodo_client";
import { hexColorByIntention } from "mogh_ui";

export default function ServerVersion({ id }: { id: string }) {
  const coreVersion = useRead("GetVersion", {}).data?.version;
  const server = useServer(id);
  const serverVersion = server?.info.version;
  const mismatch =
    !!coreVersion && !!serverVersion && coreVersion !== serverVersion;

  return (
    <HoverCard width={300} position="bottom-start">
      <HoverCard.Target>
        <Group gap="xs" wrap="nowrap">
          {!serverVersion ? (
            <ICONS.Alert size="1rem" color={hexColorByIntention("Unknown")} />
          ) : mismatch ? (
            <ICONS.Alert size="1rem" color={hexColorByIntention("Critical")} />
          ) : (
            <ICONS.Check size="1rem" color={hexColorByIntention("Good")} />
          )}
          <Text style={{ textWrap: "nowrap" }}>
            {serverVersion ?? "未知"}
          </Text>
        </Group>
      </HoverCard.Target>
      <HoverCard.Dropdown>
        {server?.info.state === Types.ServerState.Disabled ? (
          <Text>
            服务器版本 <b>已禁用</b>.
          </Text>
        ) : !serverVersion ? (
          <Text>
            Periphery 版本 <b>未知</b>.
          </Text>
        ) : mismatch ? (
          <Text>
            Periphery 版本 <b>不匹配</b>。预期版本 <b>{coreVersion}</b>.
          </Text>
        ) : (
          <Text>
            Periphery 与 Core 版本 <b>一致</b>.
          </Text>
        )}
      </HoverCard.Dropdown>
    </HoverCard>
  );
}
