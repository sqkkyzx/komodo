import { displayLabel } from "@/lib/l10n";
import { useRead } from "@/lib/hooks";
import { filterBySplit } from "mogh_ui";
import { ReactNode } from "react";
import { useSwarmDockerSearch } from ".";
import { Section } from "mogh_ui";
import { DataTable, SortableHeader } from "mogh_ui";
import SwarmResourceLink from "@/components/swarm/link";
import { StatusBadge } from "mogh_ui";
import { swarmStateIntention } from "@/lib/color";
import { SearchInput } from "mogh_ui";

export default function SwarmStacks({
  id,
  titleOther,
}: {
  id: string;
  titleOther: ReactNode;
}) {
  const [search, setSearch] = useSwarmDockerSearch();
  const stacks =
    useRead("ListSwarmStacks", { swarm: id }, { refetchInterval: 10_000 })
      .data ?? [];

  const filtered = filterBySplit(
    stacks,
    search,
    (stack) => stack.Name ?? "未知",
  );

  return (
    <Section
      titleOther={titleOther}
      actions={<SearchInput value={search} onSearch={setSearch} />}
    >
      <DataTable
        tableKey="swarm-stacks"
        data={filtered}
        columns={[
          {
            accessorKey: "Name",
            header: ({ column }) => (
              <SortableHeader column={column} title="名称" />
            ),
            cell: ({ row }) => (
              <SwarmResourceLink
                type="Stack"
                swarmId={id}
                resourceId={row.original.Name}
                name={row.original.Name}
              />
            ),
          },
          {
            accessorKey: "State",
            header: ({ column }) => (
              <SortableHeader column={column} title="状态" />
            ),
            cell: ({ row }) => (
              <StatusBadge
                text={displayLabel(row.original.State)}
                intent={swarmStateIntention(row.original.State)}
              />
            ),
          },
          {
            accessorKey: "Services",
            header: ({ column }) => (
              <SortableHeader column={column} title="服务" />
            ),
          },
        ]}
      />
    </Section>
  );
}
