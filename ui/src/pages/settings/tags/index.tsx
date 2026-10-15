import NewTag from "@/components/tags/new";
import Tag from "@/components/tags/tag";
import { useRead, useSetTitle, useUser } from "@/lib/hooks";
import { DataTable } from "mogh_ui";
import { Group, Stack } from "@mantine/core";
import { useState } from "react";
import TagColorSelector from "./color-selector";
import DeleteTag from "./delete";
import { SearchInput } from "mogh_ui";

export default function SettingsTags() {
  useSetTitle("标签");
  const user = useUser().data!;

  const [search, setSearch] = useState("");

  const tags = useRead("ListTags", {}).data;

  return (
    <Stack>
      <Group justify="space-between">
        <NewTag />
        <SearchInput value={search} onSearch={setSearch} />
      </Group>

      <DataTable
        tableKey="tags"
        data={tags?.filter((tag) => tag.name.includes(search)) ?? []}
        columns={[
          {
            header: "名称",
            accessorKey: "name",
            cell: ({ row }) => {
              return <Tag tag={row.original} size="md" fz="md" />;
            },
          },
          {
            header: "颜色",
            cell: ({ row }) => (
              <TagColorSelector
                tagId={row.original._id?.$oid!}
                color={row.original.color!}
                disabled={!user.admin && row.original.owner !== user._id?.$oid}
              />
            ),
          },
          // {
          //   header: "所有者",
          //   size: 200,
          //   cell: ({ row }) =>
          //     row.original.owner ? (
          //       <UserAvatar userId={row.original.owner} fz="md" />
          //     ) : (
          //       "未知"
          //     ),
          // },
          {
            header: "删除",
            cell: ({ row }) => (
              <DeleteTag
                tagId={row.original._id!.$oid}
                disabled={!user.admin && row.original.owner !== user._id?.$oid}
              />
            ),
          },
        ]}
      />
    </Stack>
  );
}
