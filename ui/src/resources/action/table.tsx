import { Types } from "komodo_client";
import { DataTable, SortableHeader } from "mogh_ui";
import { useResourceSelectionState } from "@/lib/hooks";
import { ActionComponents } from ".";
import TableTags from "@/components/tags/table";
import { BoxProps } from "@mantine/core";
import ResourceLink from "@/resources/link";

const SORT_KEYS = ["Name", "State", "NextRun"];

export default function ActionTable({
  resources,
  onServerSort,
  ...boxProps
}: {
  resources: Types.ActionListItem[];
  /** When provided, sorting is handled server side,
   * and sort updates are passed to this callback. */
  onServerSort?: (sort: { sort_by?: string; sort_desc?: boolean }) => void;
} & BoxProps) {
  const selectionState = useResourceSelectionState("Action");
  return (
    <DataTable
      {...boxProps}
      manualSorting={!!onServerSort}
      onSortingStateChange={
        onServerSort &&
        ((sorting) => {
          const sort = sorting.find((s) => SORT_KEYS.includes(s.id));
          onServerSort(sort ? { sort_by: sort.id, sort_desc: sort.desc } : {});
        })
      }
      tableKey="actions-table"
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
            <ResourceLink type="Action" id={row.original.id} />
          ),
        },
        {
          id: "State",
          accessorKey: "info.state",
          header: ({ column }) => (
            <SortableHeader column={column} title="状态" />
          ),
          cell: ({ row }) => <ActionComponents.State id={row.original.id} />,
        },
        {
          id: "NextRun",
          accessorKey: "info.next_scheduled_run",
          header: ({ column }) => (
            <SortableHeader column={column} title="下次运行" />
          ),
          sortFn: (a, b) => {
            const sa = a.original.info.next_scheduled_run;
            const sb = b.original.info.next_scheduled_run;

            if (!sa && !sb) return 0;
            if (!sa) return 1;
            if (!sb) return -1;

            if (sa > sb) return 1;
            else if (sa < sb) return -1;
            else return 0;
          },
          cell: ({ row }) =>
            row.original.info.next_scheduled_run
              ? new Date(row.original.info.next_scheduled_run).toLocaleString("zh-CN")
              : "未设置计划",
        },
        {
          header: "标签",
          cell: ({ row }) => <TableTags tagIds={row.original.tags} />,
        },
      ]}
    />
  );
}
