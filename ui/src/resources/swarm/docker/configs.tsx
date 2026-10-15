import { useRead } from "@/lib/hooks";
import { filterBySplit } from "mogh_ui";
import { ReactNode } from "react";
import { useSwarmDockerSearch } from ".";
import { Section } from "mogh_ui";
import { Badge, Group } from "@mantine/core";
import { DataTable, SortableHeader } from "mogh_ui";
import SwarmResourceLink from "@/components/swarm/link";
import { SearchInput } from "mogh_ui";
import NewSwarmConfig from "@/resources/swarm/new/config";

export default function SwarmConfigs({
  id,
  titleOther,
}: {
  id: string;
  titleOther: ReactNode;
}) {
  const [search, setSearch] = useSwarmDockerSearch();
  const configs =
    useRead("ListSwarmConfigs", { swarm: id }, { refetchInterval: 10_000 })
      .data ?? [];

  const filtered = filterBySplit(
    configs,
    search,
    (config) => config.Name ?? config.ID ?? "未知",
  );

  return (
    <Section
      titleOther={titleOther}
      actions={
        <Group>
          <NewSwarmConfig id={id} />
          <SearchInput value={search} onSearch={setSearch} />
        </Group>
      }
    >
      <DataTable
        tableKey="swarm-configs"
        data={filtered}
        columns={[
          {
            accessorKey: "Name",
            header: ({ column }) => (
              <SortableHeader column={column} title="名称" />
            ),
            cell: ({ row }) => (
              <SwarmResourceLink
                type="Config"
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
            accessorKey: "UpdatedAt",
            header: ({ column }) => (
              <SortableHeader column={column} title="更新时间" />
            ),
          },
          {
            accessorKey: "CreatedAt",
            header: ({ column }) => (
              <SortableHeader column={column} title="创建时间" />
            ),
          },
        ]}
      />
    </Section>
  );
}
