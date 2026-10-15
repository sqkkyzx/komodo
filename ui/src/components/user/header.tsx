import { displayLabel } from "@/lib/l10n";
import { ICONS } from "@/lib/icons";
import { DividedChildren } from "mogh_ui";
import { EntityHeader } from "mogh_ui";
import { Box, Group, Stack, Text } from "@mantine/core";
import { Types } from "komodo_client";
import UserAvatar from "@/components/user-avatar";
import UpdatesSection from "@/components/updates/section";

export interface UserHeaderProps {
  user: Types.User | undefined;
}

export default function UserHeader({ user }: UserHeaderProps) {
  const enabledIntent = user?.enabled ? "Good" : "Critical";
  const Header = (
    <Stack justify="space-between">
      <Stack gap="md" pb="md" className="bordered-light" bdrs="md">
        <EntityHeader
          name={user?.username}
          icon={ICONS.User}
          intent={enabledIntent}
          state={user?.enabled ? "已启用" : "已禁用"}
        />
        <DividedChildren px="md">
          <Box>
            <UserAvatar userId={user?._id?.$oid!} onlyAvatar />
          </Box>
          <Text>
            级别：{" "}
            <b>
              {user?.super_admin
                ? "超级管理员"
                : user?.admin
                  ? "管理员"
                  : "用户"}
            </b>
          </Text>
          <Text>
            类型：{" "}
            <b>
              {user?.config.type === "Service"
                ? "服务用户"
                : displayLabel(user?.config.type)}
            </b>
          </Text>
        </DividedChildren>
      </Stack>
    </Stack>
  );

  return (
    <>
      <Stack hiddenFrom="lg" w="100%">
        {Header}
        <UpdatesSection
          query={user?._id?.$oid && { operator: user._id.$oid }}
        />
      </Stack>
      <Group
        visibleFrom="lg"
        gap="xl"
        w="100%"
        align="stretch"
        grow
        preventGrowOverflow={false}
      >
        {Header}
        <UpdatesSection
          query={user?._id?.$oid && { operator: user._id.$oid }}
        />
      </Group>
    </>
  );
}
