import { resourceLabel } from "@/lib/l10n";
import { useInvalidate, useRead, useUser, useWrite } from "@/lib/hooks";
import {
  ConfirmButton,
  EntityPage,
  LabelledSwitch,
  PageGuard,
  PageBreadcrumbs,
  Section,
} from "mogh_ui";
import { Group, Stack } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { UserCheck, UserMinus } from "lucide-react";
import { useParams } from "react-router-dom";
import UserMemberGroups from "./member-groups";
import SpecificPermissionsSection from "@/components/permissions/specific-section";
import ApiKeysSection from "@/components/api-keys/section";
import BasePermissionsSection from "@/components/permissions/base-section";
import UserHeader from "@/components/user/header";

export default function User() {
  const adminUser = useUser().data;
  const inv = useInvalidate();
  const userId = useParams().id as string;
  const { data: users, isPending } = useRead("ListUsers", {});
  const user = users?.find((user) => user._id?.$oid === userId);
  const { mutate: updateBase } = useWrite("UpdateUserBasePermissions", {
    onSuccess: () => {
      inv(["FindUser"]);
      inv(["ListUsers"]);
      notifications.show({
        message: "用户基础权限已更新",
        color: "green",
      });
    },
  });
  const { mutate: updateAdmin } = useWrite("UpdateUserAdmin", {
    onSuccess: () => {
      inv(["FindUser"]);
      inv(["ListUsers"]);
      notifications.show({ message: "用户管理员权限已更新", color: "green" });
    },
  });
  return (
    <PageGuard
      isPending={isPending}
      error={
        !adminUser?.admin
          ? "仅管理员可访问此页面。"
          : !user
            ? "未找到用户"
            : undefined
      }
    >
      <EntityPage
        backTo="/settings"
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "设置", to: "/settings" },
              { label: user?.username },
            ]}
          />
        }
      >
        <UserHeader user={user} />
        <Stack mt="lg" gap="xl">
          {user?._id?.$oid !== adminUser?._id?.$oid &&
            (!user?.admin || (!user.super_admin && adminUser?.super_admin)) && (
              <Section title="用户权限" titleFz="h3" withBorder>
                <Group>
                  <ConfirmButton
                    icon={
                      user?.enabled ? (
                        <UserMinus className="w-4 h-4" />
                      ) : (
                        <UserCheck className="w-4 h-4" />
                      )
                    }
                    variant={user?.enabled ? "filled" : "default"}
                    color={user?.enabled ? "red" : undefined}
                    onClick={() =>
                      updateBase({ user_id: userId, enabled: !user?.enabled })
                    }
                  >
                    {user?.enabled ? "禁用用户" : "启用用户"}
                  </ConfirmButton>
                  <ConfirmButton
                    icon={
                      user?.admin ? (
                        <UserMinus className="w-4 h-4" />
                      ) : (
                        <UserCheck className="w-4 h-4" />
                      )
                    }
                    variant={user?.admin ? "filled" : "default"}
                    color={user?.admin ? "red" : undefined}
                    onClick={() =>
                      updateAdmin({ user_id: userId, admin: !user?.admin })
                    }
                  >
                    {user?.admin ? "移除管理员权限" : "设为管理员"}
                  </ConfirmButton>

                  {!user?.admin &&
                    (["Server", "Build"] as Array<"Server" | "Build">).map(
                      (item) => {
                        const key =
                          `create_${item.toLowerCase()}_permissions` as
                            | "create_server_permissions"
                            | "create_build_permissions";
                        const reqKey = `create_${item.toLowerCase()}s`;
                        return (
                          <LabelledSwitch
                            key={item}
                            label={`创建${resourceLabel(item)}权限`}
                            checked={user?.[key]}
                            onCheckedChange={(checked) =>
                              updateBase({
                                user_id: userId,
                                [reqKey]: checked,
                              })
                            }
                          />
                        );
                      },
                    )}
                </Group>
              </Section>
            )}

          {user?.enabled && !user.admin && <UserMemberGroups userId={userId} />}

          {user?.config.type === "Service" && (
            <ApiKeysSection userId={userId} mt="md" />
          )}

          {user?.enabled && !user.admin && (
            <>
              <BasePermissionsSection
                userTarget={{ type: "User", id: userId }}
                mt="md"
              />
              <SpecificPermissionsSection
                userTarget={{ type: "User", id: userId }}
                mt="md"
              />
            </>
          )}
        </Stack>
      </EntityPage>
    </PageGuard>
  );
}
