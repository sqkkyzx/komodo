import { DataTable } from "mogh_ui";
import { Section } from "mogh_ui";
import { Types } from "komodo_client";
import { useRead } from "@/lib/hooks";
import { useIsServerAvailable } from "../hooks";
import { ICONS } from "@/lib/icons";

export default function ServerSystemInfo({
  id,
  stats,
}: {
  id: string;
  stats: Types.SystemStats | undefined;
}) {
  const isServerAvailable = useIsServerAvailable(id);
  const info = useRead(
    "GetSystemInformation",
    { server: id },
    { enabled: isServerAvailable },
  ).data;
  const diskTotal = stats?.disks.reduce(
    (acc, curr) => (acc += curr.total_gb),
    0,
  );
  return (
    <Section title="系统信息" icon={<ICONS.Info size="1.3rem" />}>
      <DataTable
        tableKey="system-info"
        data={
          info
            ? [
                {
                  ...info,
                  memTotal: stats?.mem_total_gb,
                  diskTotal,
                },
              ]
            : []
        }
        columns={[
          {
            header: "主机名",
            accessorKey: "host_name",
          },
          {
            header: "操作系统",
            accessorKey: "os",
          },
          {
            header: "内核",
            accessorKey: "kernel",
          },
          {
            header: "CPU",
            accessorKey: "cpu_brand",
          },
          {
            header: "架构",
            accessorKey: "cpu_arch",
          },
          {
            header: "核心数",
            accessorFn: ({ core_count, logical_core_count }) =>
              logical_core_count
                ? `${logical_core_count} 逻辑核心 / ${core_count} 物理核心`
                : `${core_count} 物理核心`,
          },
          {
            header: "总内存",
            accessorFn: ({ memTotal }) => `${memTotal?.toFixed(2)} GB`,
          },
          {
            header: "磁盘总大小",
            accessorFn: ({ diskTotal }) => `${diskTotal?.toFixed(2)} GB`,
          },
        ]}
      />
    </Section>
  );
}
