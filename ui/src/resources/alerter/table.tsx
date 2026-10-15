import { displayLabel } from "@/lib/l10n";
import { useResourceSelectionState } from "@/lib/hooks";
import { DataTable, SortableHeader } from "mogh_ui";
import { Badge, BoxProps } from "@mantine/core";
import { Types } from "komodo_client";
import ResourceLink from "@/resources/link";
import TableTags from "@/components/tags/table";
import { StatusBadge } from "mogh_ui";

const SORT_KEYS = ["Name", "Type", "Enabled"];

export default function AlerterTable({
  resources,
  onServerSort,
  ...boxProps
}: {
  resources: Types.AlerterListItem[];
  /** When provided, sorting is handled server side,
   * and sort updates are passed to this callback. */
  onServerSort?: (sort: {
    sort_by?: string;
    sort_desc?: boolean;
  }) => void;
} & BoxProps) {
  const selectionState = useResourceSelectionState("Alerter");
  return (
    <DataTable
      {...boxProps}
      manualSorting={!!onServerSort}
      onSortingStateChange={
        onServerSort &&
        ((sorting) => {
          const sort = sorting.find((s) => SORT_KEYS.includes(s.id));
          onServerSort(
            sort ? { sort_by: sort.id, sort_desc: sort.desc } : {},
          );
        })
      }
      tableKey="alerters"
      data={resources}
      selectOptions={{
        selectKey: ({ name }) => name,
        state: selectionState,
      }}
      columns={[
        {
          id: "Name",
          accessorKey: "name",
          header: ({ column }) => (
            <SortableHeader column={column} title="名称" />
          ),
          cell: ({ row }) => (
            <ResourceLink type="Alerter" id={row.original.id} />
          ),
        },
        {
          id: "Type",
          accessorKey: "info.endpoint_type",
          header: ({ column }) => (
            <SortableHeader column={column} title="类型" />
          ),
          cell: ({ row }) => (
            <Badge size="lg">{displayLabel(row.original.info.endpoint_type)}</Badge>
          ),
        },
        {
          id: "Enabled",
          accessorKey: "info.enabled",
          header: ({ column }) => (
            <SortableHeader column={column} title="已启用" />
          ),
          cell: ({ row }) => (
            <StatusBadge
              text={displayLabel(row.original.info.enabled ? "已启用" : "已禁用")}
              intent={row.original.info.enabled ? "Good" : "Critical"}
            />
          ),
        },
        {
          header: "标签",
          cell: ({ row }) => <TableTags tagIds={row.original.tags} />,
        },
      ]}
    />
  );
}
