import { useRead } from "@/lib/hooks";
import { DataTable, SortableHeader } from "mogh_ui";
import { Section } from "mogh_ui";
import { ShowHideButton } from "mogh_ui";
import { Group, Text } from "@mantine/core";
import { useLocalStorage } from "@mantine/hooks";
import { useState } from "react";
import { filterBySplit } from "mogh_ui";
import DockerResourceLink from "@/components/docker/link";
import { useIsServerAvailable } from "../hooks";
import { SearchInput } from "mogh_ui";
import { ICONS } from "@/lib/icons";

export default function ServerContainerStats({ id }: { id: string }) {
  const [search, setSearch] = useState("");
  const [show, setShow] = useLocalStorage({
    key: "server-stats-containers-show-v2",
    defaultValue: true,
  });
  const isServerAvailable = useIsServerAvailable(id);
  const containers = useRead(
    "ListContainers",
    {
      server: id,
    },
    {
      enabled: isServerAvailable && show,
    },
  ).data?.filter((c) => c.stats);
  const filtered = filterBySplit(
    containers,
    search,
    (container) => container.name,
  );
  return (
    <Section
      withBorder
      title="容器"
      icon={<ICONS.Container size="1.3rem" />}
      titleRight={
        <Group ml={{ sm: "xl" }}>
          <SearchInput
            value={search}
            onSearch={setSearch}
            w={{ base: 200, lg: 300 }}
          />
          <ShowHideButton show={show} setShow={setShow} />
        </Group>
      }
      onHeaderClick={() => setShow((s) => !s)}
    >
      {show && (
        <DataTable
          sortDescFirst
          mah="min(400px, calc(100vh - 320px))"
          tableKey="container-stats"
          data={filtered}
          columns={[
            {
              accessorKey: "name",
              header: ({ column }) => (
                <SortableHeader column={column} title="名称" />
              ),
              cell: ({ row }) => (
                <DockerResourceLink
                  type="Container"
                  serverId={id}
                  name={row.original.name}
                />
              ),
            },
            {
              accessorKey: "stats.cpu_perc",
              header: ({ column }) => (
                <SortableHeader column={column} title="CPU" />
              ),
            },
            {
              accessorKey: "stats.mem_perc",
              header: ({ column }) => (
                <SortableHeader column={column} title="内存" />
              ),
              cell: ({ row }) => (
                <Group wrap="nowrap" gap="xs">
                  <Text>{row.original.stats?.mem_perc}</Text>
                  <Text c="muted" size="sm">
                    ({row.original.stats?.mem_usage})
                  </Text>
                </Group>
              ),
            },
            {
              accessorKey: "stats.net_io",
              header: ({ column }) => (
                <SortableHeader column={column} title="网络 I/O" />
              ),
            },
            {
              accessorKey: "stats.block_io",
              header: ({ column }) => (
                <SortableHeader column={column} title="磁盘 I/O" />
              ),
            },
            {
              accessorKey: "stats.pids",
              header: ({ column }) => (
                <SortableHeader column={column} title="PIDs" />
              ),
            },
          ]}
        />
      )}
    </Section>
  );
}
