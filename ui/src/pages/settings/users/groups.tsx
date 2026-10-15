import ExportToml from "@/components/export-toml";
import { useRead } from "@/lib/hooks";
import { filterBySplit } from "mogh_ui";
import { ICONS } from "@/lib/icons";
import { DataTable } from "mogh_ui";
import { Section } from "mogh_ui";
import { Box, Group } from "@mantine/core";
import { useNavigate } from "react-router-dom";
import DeleteUserGroup from "../../../components/user/delete-group";
import NewUserGroup from "./new-group";
import { SearchInput } from "mogh_ui";

export default function SettingsUserGroups({
  search,
  setSearch,
}: {
  search: string;
  setSearch: (search: string) => void;
}) {
  const nav = useNavigate();
  const groups = useRead("ListUserGroups", {}).data;
  const filtered = filterBySplit(groups, search, (group) => group.name);
  return (
    <Section
      title="用户组"
      icon={<ICONS.Users size="1.3rem" />}
      titleRight={
        <Box ml="md">
          <NewUserGroup />
        </Box>
      }
      actions={
        <Group>
          <SearchInput value={search} onSearch={setSearch} />
          <ExportToml userGroups={groups?.map((g) => g._id?.$oid!)} />
        </Group>
      }
    >
      <DataTable
        tableKey="user-groups"
        data={filtered}
        columns={[
          { header: "名称", accessorKey: "name" },
          {
            header: "成员",
            accessorFn: (group) =>
              group.everyone ? "所有人" : (group.users ?? []).length,
          },
          {
            header: "删除",
            cell: ({ row: { original: group } }) => (
              <DeleteUserGroup group={group} />
            ),
          },
        ]}
        onRowClick={(group) => nav(`/user-groups/${group._id!.$oid}`)}
      />
    </Section>
  );
}
