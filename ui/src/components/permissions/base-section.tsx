import { resourceLabel } from "@/lib/l10n";
import { useInvalidate, useRead, useWrite } from "@/lib/hooks";
import { levelSortingFn } from "@/lib/utils";
import {
  RESOURCE_TARGETS,
  ResourceComponents,
  UsableResource,
} from "@/resources";
import { DataTable, SortableHeader, filterBySplit } from "mogh_ui";
import { Section, SectionProps } from "mogh_ui";
import { Group, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { Types } from "komodo_client";
import { useState } from "react";
import PermissionLevelSelector from "./level-selector";
import SpecificPermissionSelector from "./specific-selector";
import { SearchInput } from "mogh_ui";
import { LabelledSwitch } from "mogh_ui";

export interface BasePermissionsSectionProps extends SectionProps {
  userTarget: Types.UserTarget;
}

export default function BasePermissionsSection({
  userTarget,
  ...sectionProps
}: BasePermissionsSectionProps) {
  const [showAll, setShowAll] = useState(false);
  const [search, setSearch] = useState("");

  const { data: user, isPending: userPending } = useRead(
    "FindUser",
    { user: userTarget.id },
    { enabled: userTarget.type === "User" },
  );
  const { data: group, isPending: groupPending } = useRead(
    "GetUserGroup",
    { user_group: userTarget.id },
    { enabled: userTarget.type === "UserGroup" },
  );

  const inv = useInvalidate();
  const { mutate: update } = useWrite("UpdatePermissionOnResourceType", {
    onSuccess: () => {
      notifications.show({
        message: "目标权限已更新。",
        color: "green",
      });
      if (userTarget.type === "User") {
        inv(["FindUser", { user: userTarget.id }]);
      } else if (userTarget.type === "UserGroup") {
        inv(["GetUserGroup", { user_group: userTarget.id }]);
      }
    },
  });

  const all = userTarget.type === "User" ? user?.all : group?.all;
  const permissions = RESOURCE_TARGETS.map((type) => {
    const permission = all?.[type] ?? Types.PermissionLevel.None;
    return {
      type,
      level: typeof permission === "string" ? permission : permission.level,
      specific: typeof permission === "string" ? [] : permission.specific,
    };
  }).filter(
    (item) =>
      showAll ||
      item.level !== Types.PermissionLevel.None ||
      item.specific.length !== 0,
  );

  const filtered = filterBySplit(
    permissions,
    search,
    (p) => `${p.type} ${resourceLabel(p.type)}`,
  );

  return (
    <Section
      isPending={userTarget.type === "User" ? userPending : groupPending}
      error={
        userTarget.type === "User"
          ? !user
            ? "未找到对应 ID 的用户"
            : undefined
          : !group
            ? "未找到对应 ID 的用户组"
            : undefined
      }
      title="资源类型基础权限"
      titleFz="h3"
      actions={
        <Group>
          <SearchInput value={search} onSearch={setSearch} />
          <LabelledSwitch
            checked={showAll}
            onCheckedChange={setShowAll}
            label="显示全部"
          />
        </Group>
      }
      {...sectionProps}
    >
      <DataTable
        tableKey="base-permissions-v1"
        data={filtered}
        columns={[
          {
            accessorKey: "type",
            header: ({ column }) => (
              <SortableHeader column={column} title="资源类型" />
            ),
            cell: ({ row }) => {
              const RC =
                ResourceComponents[row.original.type as UsableResource];
              return (
                <Group gap="sm">
                  <RC.Icon />
                  <Text>{resourceLabel(row.original.type)}</Text>
                </Group>
              );
            },
          },
          {
            accessorKey: "level",
            sortFn: (a, b) =>
              levelSortingFn(a.original.level, b.original.level),
            header: ({ column }) => (
              <SortableHeader column={column} title="级别" />
            ),
            cell: ({ row }) => (
              <PermissionLevelSelector
                level={row.original.level ?? Types.PermissionLevel.None}
                onChange={(level) => {
                  update({
                    user_target: userTarget,
                    resource_type: row.original.type,
                    permission: {
                      level,
                      specific: row.original.specific,
                    },
                  });
                }}
              />
            ),
          },
          {
            header: "具体权限",
            cell: ({ row }) => {
              return (
                <SpecificPermissionSelector
                  type={row.original.type}
                  specific={row.original.specific}
                  onChange={(specific) => {
                    update({
                      user_target: userTarget,
                      resource_type: row.original.type,
                      permission: {
                        level: row.original.level,
                        specific,
                      },
                    });
                  }}
                />
              );
            },
          },
        ]}
      />
    </Section>
  );
}
