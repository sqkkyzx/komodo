import { displayLabel } from "@/lib/l10n";
import { useAlertDetails } from "@/components/alerts/details";
import AlertLevel from "@/components/alerts/level";
import ResourceTypeSelector from "@/components/resource-type-selector";
import { alertLevelIntention } from "@/lib/color";
import { useRead } from "@/lib/hooks";
import { UsableResource } from "@/resources";
import ResourceLink from "@/resources/link";
import ResourceSelector from "@/resources/selector";
import { ICONS } from "@/lib/icons";
import { DataTable } from "mogh_ui";
import { LabelledSwitch } from "mogh_ui";
import { Page } from "mogh_ui";
import { StatusBadge } from "mogh_ui";
import { ActionIcon, Group, Pagination, Select, Stack } from "@mantine/core";
import { Types } from "komodo_client";
import { keepPreviousData } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

const ALERT_TYPES_BY_RESOURCE: { [key: string]: Types.AlertData["type"][] } = {
  Server: ["ServerUnreachable", "ServerCpu", "ServerMem", "ServerDisk"],
  Swarm: ["SwarmUnhealthy"],
  Stack: ["StackStateChange", "StackImageUpdateAvailable", "StackAutoUpdated"],
  Deployment: [
    "ContainerStateChange",
    "DeploymentImageUpdateAvailable",
    "DeploymentAutoUpdated",
  ],
  Build: ["BuildFailed"],
  Repo: ["RepoBuildFailed"],
  ResourceSync: ["ResourceSyncPendingUpdates"],
};

const FALLBACK_ALERT_TYPES = [
  ...Object.values(ALERT_TYPES_BY_RESOURCE).flat(),
  "AwsBuilderTerminationFailed",
];

export default function Alerts() {
  const [page, setPage] = useState(0);
  const [params, setParams] = useSearchParams();
  const { open: openDetails } = useAlertDetails();

  const { type, id, alertType, open } = useMemo(
    () => ({
      type: (params.get("type") as UsableResource) ?? undefined,
      id: params.get("id") ?? undefined,
      alertType: (params.get("alert") as Types.AlertData["type"]) ?? undefined,
      open: params.get("open") === "true" || undefined,
    }),
    [params],
  );

  const { data: alerts } = useRead(
    "ListAlerts",
    {
      query: {
        "target.type": type,
        "target.id": id,
        "data.type": alertType,
        resolved: !open,
      },
      page,
    },
    // Keep the previous rows visible while fetching after a
    // query key change (page / filters) to prevent table flashing.
    { placeholderData: keepPreviousData },
  );

  const alertTypes: string[] = type
    ? (ALERT_TYPES_BY_RESOURCE[type] ?? FALLBACK_ALERT_TYPES)
    : FALLBACK_ALERT_TYPES;

  return (
    <Page title="告警" icon={ICONS.Alert} description="查看历史告警">
      <Stack>
        {/* QUERY */}
        <Group>
          {/* RESOURCE TYPE */}
          <ResourceTypeSelector
            value={type}
            onChange={(type) => {
              const p = new URLSearchParams(params.toString());
              if (type) {
                p.set("type", type);
              } else {
                p.delete("type");
              }
              p.delete("id");
              p.delete("operation");
              setParams(p);
            }}
          />

          {/* RESOURCE ID */}
          {type && (
            <ResourceSelector
              type={type}
              selected={id ?? undefined}
              onSelect={(id) => {
                const p = new URLSearchParams(params.toString());
                id === "" ? p.delete("id") : p.set("id", id);
                setParams(p);
              }}
              targetProps={{ w: { base: "100%", xs: 250 } }}
            />
          )}

          {/* ALERT TYPE */}
          <Select
            value={alertType}
            placeholder="选择告警类型"
            onChange={(type) => {
              const p = new URLSearchParams(params.toString());
              if (type) {
                p.set("alertType", type);
              } else {
                p.delete("alertType");
              }
              setParams(p);
            }}
            data={alertTypes.map((value) => ({
              value,
              label: displayLabel(value),
            }))}
            w={{ base: "100%", xs: 250 }}
            searchable
            clearable
          />

          <LabelledSwitch
            label="仅显示未解决"
            checked={open}
            onCheckedChange={() => {
              const p = new URLSearchParams(params.toString());
              open ? p.delete("open") : p.set("open", "true");
              setParams(p);
            }}
          />

          {/* RESET */}
          <ActionIcon
            onClick={() => setParams({})}
            variant="filled"
            color="red"
            disabled={!params.size}
          >
            <ICONS.Clear size="1rem" />
          </ActionIcon>

          {/* PAGINATION */}
          <Pagination.Root
            total={alerts?.next_page ? page + 2 : page + 1}
            value={page + 1}
            onChange={(page) => setPage(page - 1)}
          >
            <Group gap="0.2rem" justify="center">
              <Pagination.First />
              <Pagination.Previous />
              <Pagination.Items />
              <Pagination.Next />
            </Group>
          </Pagination.Root>
        </Group>

        <DataTable
          tableKey="alerts"
          data={alerts?.alerts ?? []}
          columns={[
            {
              header: "详情",
              cell: () => {
                return (
                  <ActionIcon>
                    <ICONS.Search size="1rem" />
                  </ActionIcon>
                );
              },
            },
            !params.get("id") && {
              header: "资源",
              cell: ({ row }) => {
                const type = row.original.target.type as UsableResource;
                return <ResourceLink type={type} id={row.original.target.id} />;
              },
            },
            {
              header: "状态",
              cell: ({ row }) => {
                return (
                  <StatusBadge
                    text={row.original.resolved ? "已解决" : "未解决"}
                    intent={
                      row.original.resolved
                        ? "Good"
                        : alertLevelIntention(row.original.level)
                    }
                  />
                );
              },
            },
            {
              header: "级别",
              cell: ({ row }) => <AlertLevel level={row.original.level} />,
            },
            {
              header: "告警类型",
              accessorKey: "data.type",
              cell: ({ row }) => displayLabel(row.original.data.type),
            },
          ]}
          onRowClick={(row) => openDetails(row._id?.$oid!)}
        />
      </Stack>
    </Page>
  );
}
