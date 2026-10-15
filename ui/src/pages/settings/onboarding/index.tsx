import Tags from "@/components/tags";
import TagSelector from "@/components/tags/selector";
import { useInvalidate, useRead, useSetTitle, useWrite } from "@/lib/hooks";
import ResourceSelector from "@/resources/selector";
import { ICONS } from "@/lib/icons";
import {
  DataTable,
  DataTableFeatures,
  fmtDateWithMinutes,
  SortableHeader,
} from "mogh_ui";
import { Badge, Group, Switch, TextInput, useMatches } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { ColumnDef } from "@tanstack/react-table";
import { Types } from "komodo_client";
import { useMemo } from "react";
import DeleteOnboardingKey from "./delete";
import { Section } from "mogh_ui";
import NewOnboardingKey from "./new";

export default function SettingsOnboardingKeys() {
  useSetTitle("服务器注册");
  const { data } = useRead("ListOnboardingKeys", {});
  const keys = data ?? [];
  const invalidate = useInvalidate();
  const { mutate } = useWrite("UpdateOnboardingKey", {
    onSuccess: () => {
      invalidate(["ListOnboardingKeys"]);
      notifications.show({ message: "注册密钥已更新", color: "green" });
    },
  });
  const expiresSize = useMatches({
    base: "sm",
    xl: "md",
  });
  const columns: (
    | ColumnDef<DataTableFeatures, Types.OnboardingKey, unknown>
    | false
    | undefined
  )[] = useMemo(
    () => [
      {
        accessorKey: "name",
        header: ({ column }) => <SortableHeader column={column} title="名称" />,
        cell: ({ row }) => (
          <TextInput
            defaultValue={row.original.name}
            onBlur={(e) =>
              e.target.value != row.original.name &&
              mutate({
                public_key: row.original.public_key,
                name: e.target.value,
              })
            }
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            miw={200}
          />
        ),
      },
      {
        accessorKey: "copy_server",
        header: "模板",
        cell: ({ row }) => (
          <ResourceSelector
            type="Server"
            selected={row.original.copy_server}
            templates={Types.TemplatesQueryBehavior.Include}
            onSelect={(copy_server) =>
              mutate({ public_key: row.original.public_key, copy_server })
            }
          />
        ),
      },
      {
        accessorKey: "tags",
        header: "标签",
        cell: ({ row }) => {
          const tags = useRead("ListTags", {}).data;
          const otherTags = tags?.filter(
            (tag) => !row.original.tags?.includes(tag.name),
          );
          return (
            <Group wrap="nowrap" gap="sm">
              <TagSelector
                title="选择标签"
                tags={otherTags}
                onSelect={(tag) =>
                  mutate({
                    public_key: row.original.public_key,
                    tags: [...(row.original.tags ?? []), tag],
                  })
                }
                position="bottom-start"
                useName
                canCreate
              />

              <Tags
                tagIds={
                  tags
                    ?.filter((tag) => row.original.tags?.includes(tag.name))
                    .map((tag) => tag.name) ?? []
                }
                onBadgeClick={(toRemove) =>
                  mutate({
                    public_key: row.original.public_key,
                    tags: row.original.tags?.filter(
                      (tagName) => tagName !== toRemove,
                    ),
                  })
                }
                icon={<ICONS.Remove size="1rem" />}
                fz="1rem"
                useName
              />
            </Group>
          );
        },
      },
      {
        accessorKey: "privileged",
        header: ({ column }) => (
          <SortableHeader
            column={column}
            title="特权"
            description="允许此注册密钥更新现有服务器的公钥和配置以建立连接。"
          />
        ),
        cell: ({ row }) => (
          <Switch
            checked={row.original.privileged}
            onChange={(e) =>
              mutate({
                public_key: row.original.public_key,
                privileged: e.target.checked,
              })
            }
          />
        ),
      },
      {
        accessorKey: "create_builder",
        header: ({ column }) => (
          <SortableHeader column={column} title="创建构建器" />
        ),
        cell: ({ row }) => (
          <Switch
            checked={row.original.create_builder}
            onChange={(e) =>
              mutate({
                public_key: row.original.public_key,
                create_builder: e.target.checked,
              })
            }
          />
        ),
      },
      {
        accessorKey: "enabled",
        header: ({ column }) => (
          <SortableHeader column={column} title="已启用" />
        ),
        cell: ({
          row: {
            original: { public_key, expires, enabled },
          },
        }) => (
          <Switch
            checked={expires && expires <= Date.now() ? false : enabled}
            onChange={(e) => mutate({ public_key, enabled: e.target.checked })}
            disabled={!!expires && expires <= Date.now()}
          />
        ),
      },
      {
        accessorKey: "expires",
        header: ({ column }) => (
          <SortableHeader column={column} title="过期时间" />
        ),
        cell: ({
          row: {
            original: { expires },
          },
        }) => (
          <Badge
            color={expires && expires <= Date.now() ? "red" : "accent"}
            fz="sm"
            p="sm"
            styles={{ label: { width: "fit-content", height: "fit-content" } }}
            size={expiresSize}
          >
            {expires ? fmtDateWithMinutes(new Date(expires)) : "永不过期"}
          </Badge>
        ),
      },
      {
        accessorKey: "public_key",
        header: "删除",
        cell: ({ row }) => (
          <DeleteOnboardingKey publicKey={row.original.public_key} />
        ),
      },
    ],
    [mutate],
  );

  return (
    <Section
      title="服务器注册密钥"
      icon={<ICONS.OnboardingKey className="w-5 h-5" />}
      actions={<NewOnboardingKey />}
    >
      <DataTable
        tableKey="server-onboarding-keys-v1"
        data={keys}
        columns={columns}
      />
    </Section>
  );
}
