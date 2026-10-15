import { displayLabel } from "@/lib/l10n";
import { ReactNode } from "react";
import { useServerDockerSearch } from ".";
import { useDockerSelectionState, useRead } from "@/lib/hooks";
import DockerBatchExecutions from "@/components/docker/batch-executions";
import { filterBySplit } from "mogh_ui";
import { Section } from "mogh_ui";
import { Prune } from "../executions";
import { Badge, Group } from "@mantine/core";
import { DataTable, SortableHeader } from "mogh_ui";
import DockerResourceLink from "@/components/docker/link";
import { SearchInput } from "mogh_ui";

export default function ServerNetworks({
  id,
  titleOther,
}: {
  id: string;
  titleOther: ReactNode;
}) {
  const [search, setSearch] = useServerDockerSearch();
  const selectionState = useDockerSelectionState("Network");
  const networks =
    useRead("ListNetworks", { server: id }, { refetchInterval: 10_000 }).data ??
    [];

  const allInUse = networks.every((network) =>
    // this ignores networks that come in with no name, but they should all come in with name
    !network.name
      ? true
      : ["none", "host", "bridge"].includes(network.name)
        ? true
        : network.in_use,
  );

  const filtered = filterBySplit(
    networks,
    search,
    (network) => network.name ?? "",
  );

  return (
    <Section titleOther={titleOther}>
      <Group justify="space-between">
        <Group>
          <DockerBatchExecutions type="Network" />
          {!allInUse && <Prune serverId={id} type="Networks" />}
        </Group>

        <SearchInput value={search} onSearch={setSearch} />
      </Group>

      <DataTable
        mih="60vh"
        tableKey="server-networks"
        data={filtered}
        selectOptions={{
          selectKey: ({ name }) => `${id} ${name}`,
          state: selectionState,
          // System networks (and unnamed ones) cannot be deleted.
          disableRow: (row) =>
            !!row.original.name &&
            !["none", "host", "bridge"].includes(row.original.name),
        }}
        columns={[
          {
            accessorKey: "name",
            header: ({ column }) => (
              <SortableHeader column={column} title="名称" />
            ),
            cell: ({ row }) => (
              <div className="flex items-center gap-2">
                <DockerResourceLink
                  type="Network"
                  serverId={id}
                  name={row.original.name}
                  extra={
                    ["none", "host", "bridge"].includes(
                      row.original.name ?? "",
                    ) ? (
                      <Badge>系统</Badge>
                    ) : (
                      !row.original.in_use && <Badge color="red">未使用</Badge>
                    )
                  }
                />
              </div>
            ),
          },
          {
            accessorKey: "driver",
            header: ({ column }) => (
              <SortableHeader column={column} title="驱动" />
            ),
          },
          {
            accessorKey: "scope",
            cell: ({ row }) => displayLabel(row.original.scope),
            header: ({ column }) => (
              <SortableHeader column={column} title="作用域" />
            ),
          },
          {
            accessorKey: "attachable",
            cell: ({ row }) => row.original.attachable ? "是" : "否",
            header: ({ column }) => (
              <SortableHeader column={column} title="允许连接" />
            ),
          },
          {
            accessorKey: "ipam_driver",
            header: ({ column }) => (
              <SortableHeader column={column} title="IPAM 驱动" />
            ),
          },
        ]}
      />
    </Section>
  );
}
