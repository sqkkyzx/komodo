import { resourceLabel } from "@/lib/l10n";
import { useInvalidate, useWrite } from "@/lib/hooks";
import { levelSortingFn } from "@/lib/utils";
import { ResourceComponents, UsableResource } from "@/resources";
import ResourceLink from "@/resources/link";
import { DataTable, SortableHeader } from "mogh_ui";
import { SearchInput } from "mogh_ui";
import { Section, SectionProps } from "mogh_ui";
import { Group, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { Types } from "komodo_client";
import { useMemo, useState } from "react";
import ResourceTypeSelector from "../resource-type-selector";
import { LabelledSwitch } from "mogh_ui";
import PermissionLevelSelector from "./level-selector";
import SpecificPermissionSelector from "./specific-selector";
import { useUserTargetPermissions } from "./hooks";

export interface SpecificPermissionsTableProps extends SectionProps {
  userTarget: Types.UserTarget;
}

export default function SpecificPermissionsSection({
  userTarget,
  ...sectionProps
}: SpecificPermissionsTableProps) {
  const [showAll, setShowAll] = useState(false);
  const [resourceType, setResourceType] = useState<UsableResource | null>(null);

  const inv = useInvalidate();
  const { mutate: update } = useWrite("UpdatePermissionOnTarget", {
    onSuccess: () => {
      inv(["ListUserTargetPermissions"]);
      notifications.show({ message: "权限已更新", color: "green" });
    },
  });

  const { permissions, search, setSearch } =
    useUserTargetPermissions(userTarget);

  const Table = useMemo(() => {
    const tableData =
      permissions?.filter(
        (permission) =>
          (resourceType === null
            ? true
            : permission.resource_target.type === resourceType) &&
          (showAll ? true : permission.level !== Types.PermissionLevel.None),
      ) ?? [];
    return (
      <DataTable
        tableKey="specific-permissions-v1"
        data={tableData}
        columns={[
          {
            accessorKey: "resource_target.type",
            header: ({ column }) => (
              <SortableHeader column={column} title="资源" />
            ),
            cell: ({ row }) => {
              const RC =
                ResourceComponents[
                  row.original.resource_target.type as UsableResource
                ];
              return (
                <Group gap="sm">
                  <RC.Icon />
                  <Text>
                    {resourceLabel(row.original.resource_target.type)}
                  </Text>
                </Group>
              );
            },
          },
          {
            accessorKey: "resource_target",
            header: ({ column }) => (
              <SortableHeader column={column} title="目标" />
            ),
            cell: ({
              row: {
                original: { resource_target },
              },
            }) => {
              return (
                <ResourceLink
                  type={resource_target.type as UsableResource}
                  id={resource_target.id}
                />
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
            cell: ({ row: { original: permission } }) => (
              <PermissionLevelSelector
                level={permission.level ?? Types.PermissionLevel.None}
                onChange={(value) =>
                  update({
                    ...permission,
                    user_target: userTarget,
                    permission: {
                      level: value,
                      specific: permission.specific ?? [],
                    },
                  })
                }
              />
            ),
          },
          {
            header: "具体权限",
            cell: ({ row: { original: permission } }) => {
              return (
                <SpecificPermissionSelector
                  type={permission.resource_target.type as UsableResource}
                  specific={permission.specific ?? []}
                  onChange={(specific) => {
                    update({
                      ...permission,
                      user_target: userTarget,
                      permission: {
                        level: permission.level ?? Types.PermissionLevel.None,
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
    );
  }, [showAll, resourceType, permissions]);

  return (
    <Section
      title="各资源权限"
      titleFz="h3"
      actions={
        <Group>
          <SearchInput value={search} onSearch={setSearch} />
          <ResourceTypeSelector
            value={resourceType}
            onChange={setResourceType}
          />
          <LabelledSwitch
            checked={showAll}
            onCheckedChange={setShowAll}
            label="显示全部"
          />
        </Group>
      }
      {...sectionProps}
    >
      {Table}
    </Section>
  );
}
