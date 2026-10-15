import { useRead } from "@/lib/hooks";
import { filterBySplit } from "mogh_ui";
import { ReactNode } from "react";
import { useSwarmDockerSearch } from ".";
import { Section } from "mogh_ui";
import { Badge, Group } from "@mantine/core";
import { DataTable, SortableHeader } from "mogh_ui";
import SwarmResourceLink from "@/components/swarm/link";
import { SearchInput } from "mogh_ui";
import NewSwarmSecret from "@/resources/swarm/new/secret";

export default function SwarmSecrets({
  id,
  titleOther,
}: {
  id: string;
  titleOther: ReactNode;
}) {
  const [search, setSearch] = useSwarmDockerSearch();
  const secrets =
    useRead("ListSwarmSecrets", { swarm: id }, { refetchInterval: 10_000 })
      .data ?? [];

  const filtered = filterBySplit(
    secrets,
    search,
    (secret) => secret.Name ?? secret.ID ?? "未知",
  );

  return (
    <Section
      titleOther={titleOther}
      actions={
        <Group>
          <NewSwarmSecret id={id} />
          <SearchInput value={search} onSearch={setSearch} />
        </Group>
      }
    >
      <DataTable
        tableKey="swarm-secrets"
        data={filtered}
        columns={[
          {
            accessorKey: "Name",
            header: ({ column }) => (
              <SortableHeader column={column} title="名称" />
            ),
            cell: ({ row }) => (
              <SwarmResourceLink
                type="Secret"
                swarmId={id}
                resourceId={row.original.Name}
                name={row.original.Name}
                extra={
                  !row.original.InUse && (
                    <Badge variant="filled" color="red">
                      未使用
                    </Badge>
                  )
                }
              />
            ),
          },
          {
            accessorKey: "ID",
            header: ({ column }) => (
              <SortableHeader column={column} title="ID" />
            ),
            cell: ({ row }) => row.original.ID ?? "未知",
          },
          {
            accessorKey: "Driver",
            header: ({ column }) => (
              <SortableHeader column={column} title="驱动" />
            ),
            cell: ({ row }) =>
              row.original.Driver ?? (
                <div className="text-muted-foreground">无</div>
              ),
          },
          {
            accessorKey: "Templating",
            header: ({ column }) => (
              <SortableHeader column={column} title="模板处理" />
            ),
            cell: ({ row }) =>
              row.original.Templating ?? (
                <div className="text-muted-foreground">无</div>
              ),
          },
          {
            accessorKey: "UpdatedAt",
            header: ({ column }) => (
              <SortableHeader column={column} title="更新时间" />
            ),
            cell: ({ row }) =>
              row.original.UpdatedAt
                ? new Date(row.original.UpdatedAt).toLocaleString("zh-CN")
                : "未知",
          },
          {
            accessorKey: "CreatedAt",
            header: ({ column }) => (
              <SortableHeader column={column} title="创建时间" />
            ),
            cell: ({ row }) =>
              row.original.CreatedAt
                ? new Date(row.original.CreatedAt).toLocaleString("zh-CN")
                : "未知",
          },
        ]}
      />
    </Section>
  );
}
