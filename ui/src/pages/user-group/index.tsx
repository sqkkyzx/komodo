import UserTable from "@/components/user/table";
import { useInvalidate, useRead, useUser, useWrite } from "@/lib/hooks";
import { ICONS } from "@/lib/icons";
import {
  DividedChildren,
  EntityHeader,
  EntityPage,
  PageBreadcrumbs,
  PageGuard,
  Section,
} from "mogh_ui";
import { Group, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useParams } from "react-router-dom";
import UserGroupAddUser from "./add-user";
import { LabelledSwitch } from "mogh_ui";
import BasePermissionsSection from "@/components/permissions/base-section";
import SpecificPermissionsSection from "@/components/permissions/specific-section";
import DeleteUserGroup from "./delete";

export default function UserGroup() {
  const adminUser = useUser().data;
  const inv = useInvalidate();
  const groupId = useParams().id as string;
  const group = useRead("ListUserGroups", {}).data?.find(
    (group) => group._id?.$oid === groupId,
  );

  const { data: users, isPending } = useRead("ListUsers", {});

  const { mutateAsync: rename, isPending: renamePending } = useWrite(
    "RenameUserGroup",
    {
      onSuccess: () => {
        inv(["ListUserGroups"]);
        notifications.show({ message: "用户组已重命名", color: "green" });
      },
    },
  );

  const removeMutate = useWrite("RemoveUserFromUserGroup", {
    onSuccess: () => {
      inv(["ListUserGroups"]);
      notifications.show({
        message: "已将用户移出用户组",
        color: "green",
      });
    },
  }).mutate;

  const everyoneMutate = useWrite("SetEveryoneUserGroup", {
    onSuccess: () => {
      inv(["ListUserGroups"]);
      notifications.show({
        message: "用户组的所有人设置已更新",
        color: "green",
      });
    },
  }).mutate;

  return (
    <PageGuard
      isPending={isPending}
      error={
        !adminUser?.admin
          ? "仅管理员可访问此页面。"
          : !group
            ? "未找到用户组"
            : undefined
      }
    >
      <EntityPage
        backTo="/settings"
        breadcrumbs={
          <PageBreadcrumbs
            items={[{ label: "设置", to: "/settings" }, { label: group?.name }]}
          />
        }
      >
        <Stack gap="md" pb="md" className="bordered-light" bdrs="md">
          <EntityHeader
            name={group?.name}
            icon={ICONS.UserGroup}
            intent="Good"
            onRename={(name) => rename({ id: groupId, name })}
            renamePending={renamePending}
            action={<DeleteUserGroup groupId={groupId} />}
          />
          <DividedChildren px="md">
            <Text>用户组</Text>
            <Text>
              {group?.everyone && "所有人"}
              {!group?.everyone && (group?.users?.length ?? 0 > 0) && (
                <>{(group?.users ?? []).length} 位用户</>
              )}
              {!group?.everyone && (group?.users?.length ?? 0) === 0 && (
                <>暂无用户</>
              )}
            </Text>
          </DividedChildren>
        </Stack>

        <Stack mt="lg" gap="xl">
          <Section
            title="用户"
            titleFz="h3"
            icon={<ICONS.User size="1.2rem" />}
            titleRight={
              <Group ml="md">
                {!group?.everyone && <UserGroupAddUser groupId={groupId} />}
                <LabelledSwitch
                  label="所有人"
                  checked={group?.everyone}
                  onCheckedChange={(everyone) =>
                    everyoneMutate({ user_group: groupId, everyone })
                  }
                />
                {group?.everyone && (
                  <Text c="dimmed">所有用户都将继承此用户组的权限。</Text>
                )}
              </Group>
            }
            withBorder
          >
            {!group?.everyone && (
              <UserTable
                noBorder
                users={
                  users?.filter((user) =>
                    group
                      ? (group.users ?? []).includes(user._id?.$oid!)
                      : false,
                  ) ?? []
                }
                onUserRemove={(user) =>
                  removeMutate({ user_group: groupId, user })
                }
              />
            )}
          </Section>

          <BasePermissionsSection
            userTarget={{ type: "UserGroup", id: groupId }}
            mt="md"
          />
          <SpecificPermissionsSection
            userTarget={{ type: "UserGroup", id: groupId }}
            mt="md"
          />
        </Stack>
      </EntityPage>
    </PageGuard>
  );
}
