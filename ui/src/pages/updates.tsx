import { displayLabel } from "@/lib/l10n";
import ResourceTypeSelector from "@/components/resource-type-selector";
import { useUpdateDetails } from "@/components/updates/details";
import UserAvatar from "@/components/user-avatar";
import { useRead, useSetTitle } from "@/lib/hooks";
import { UsableResource } from "@/resources";
import ResourceLink from "@/resources/link";
import ResourceSelector from "@/resources/selector";
import { ICONS } from "@/lib/icons";
import { StatusBadge, fmtDateWithMinutes, DataTable, Page } from "mogh_ui";
import {
  ActionIcon,
  Group,
  Pagination,
  Select,
  Stack,
  Text,
} from "@mantine/core";
import { Types } from "komodo_client";
import { keepPreviousData } from "@tanstack/react-query";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";

export default function Updates() {
  useSetTitle("更新记录");
  const [page, setPage] = useState(0);
  const [params, setParams] = useSearchParams();
  const { open: openDetails } = useUpdateDetails();

  const { type, id, operation } = {
    type: params.get("type") as UsableResource | null,
    id: params.get("id"),
    operation: params.get("operation") as Types.Operation | null,
  };

  const { data: updates } = useRead(
    "ListUpdates",
    {
      query: {
        "target.type": type ?? undefined,
        "target.id": id ?? undefined,
        operation: operation ?? undefined,
      },
      page,
    },
    // Keep the previous rows visible while fetching after a
    // query key change (page / filters) to prevent table flashing.
    { placeholderData: keepPreviousData },
  );

  return (
    <Page title="更新记录" icon={ICONS.Update} description="查看历史更新">
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

          {/* OPERATION */}
          <Select
            value={operation}
            placeholder="选择操作"
            onChange={(op) => {
              const p = new URLSearchParams(params.toString());
              if (op) {
                p.set("operation", op);
              } else {
                p.delete("operation");
              }
              setParams(p);
            }}
            data={(type
              ? OPERATIONS_BY_RESOURCE[type]
              : Object.values(Types.Operation).filter(
                  (o) => o !== Types.Operation.None,
                )
            )?.map((value) => ({ value, label: displayLabel(value) }))}
            w={{ base: "100%", xs: 250 }}
            searchable
            clearable
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
            total={updates?.next_page ? page + 2 : page + 1}
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
          tableKey="updates"
          data={updates?.updates ?? []}
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
              cell: ({ row }) =>
                row.original.target.type === "System" ? (
                  <Group gap="xs" wrap="nowrap">
                    <ICONS.System size="1rem" />
                    <Text>系统</Text>
                  </Group>
                ) : (
                  <ResourceLink
                    type={row.original.target.type}
                    id={row.original.target.id}
                  />
                ),
            },
            {
              header: "操作",
              accessorKey: "operation",
              cell: ({ row }) => {
                const more =
                  row.original.status === Types.UpdateStatus.InProgress
                    ? "进行中"
                    : row.original.status === Types.UpdateStatus.Queued
                      ? "排队中"
                      : undefined;
                return (
                  <Group gap="xs" wrap="nowrap">
                    <Text>{displayLabel(row.original.operation)}</Text>
                    {more && <Text c="dimmed">{more}</Text>}
                  </Group>
                );
              },
            },
            {
              header: "结果",
              cell: ({ row }) => {
                const { success, status } = row.original;
                return (
                  <StatusBadge
                    intent={
                      status === Types.UpdateStatus.Complete
                        ? success
                          ? "Good"
                          : "Critical"
                        : "None"
                    }
                    text={
                      status === Types.UpdateStatus.Complete
                        ? success
                          ? "成功"
                          : "失败"
                        : "处理中"
                    }
                  />
                );
              },
            },
            {
              header: "开始时间",
              accessorFn: ({ start_ts }) =>
                fmtDateWithMinutes(new Date(start_ts)),
            },
            {
              header: "操作人",
              accessorKey: "operator",
              cell: ({ row }) => (
                <UserAvatar userId={row.original.operator} fz="md" />
              ),
            },
          ]}
          onRowClick={(row) => openDetails(row.id)}
        />
      </Stack>
    </Page>
  );
}

const OPERATIONS_BY_RESOURCE: { [key: string]: Types.Operation[] } = {
  Server: [
    Types.Operation.CreateServer,
    Types.Operation.UpdateServer,
    Types.Operation.DeleteServer,
    Types.Operation.RenameServer,
    Types.Operation.StartContainer,
    Types.Operation.RestartContainer,
    Types.Operation.PauseContainer,
    Types.Operation.UnpauseContainer,
    Types.Operation.StopContainer,
    Types.Operation.DestroyContainer,
    Types.Operation.StartAllContainers,
    Types.Operation.RestartAllContainers,
    Types.Operation.PauseAllContainers,
    Types.Operation.UnpauseAllContainers,
    Types.Operation.StopAllContainers,
    Types.Operation.PruneContainers,
    Types.Operation.CreateNetwork,
    Types.Operation.DeleteNetwork,
    Types.Operation.PruneNetworks,
    Types.Operation.DeleteImage,
    Types.Operation.PruneImages,
    Types.Operation.DeleteVolume,
    Types.Operation.PruneVolumes,
    Types.Operation.PruneDockerBuilders,
    Types.Operation.PruneBuildx,
    Types.Operation.PruneSystem,
  ],
  Swarm: [
    Types.Operation.CreateSwarm,
    Types.Operation.UpdateSwarm,
    Types.Operation.DeleteSwarm,
    Types.Operation.RenameSwarm,
    Types.Operation.RemoveSwarmNodes,
    Types.Operation.RemoveSwarmStacks,
    Types.Operation.RemoveSwarmServices,
    Types.Operation.CreateSwarmConfig,
    Types.Operation.RotateSwarmConfig,
    Types.Operation.RemoveSwarmConfigs,
    Types.Operation.CreateSwarmSecret,
    Types.Operation.RotateSwarmSecret,
    Types.Operation.RemoveSwarmSecrets,
  ],
  Stack: [
    Types.Operation.CreateStack,
    Types.Operation.UpdateStack,
    Types.Operation.RenameStack,
    Types.Operation.DeleteStack,
    Types.Operation.WriteStackContents,
    Types.Operation.RefreshStackCache,
    Types.Operation.DeployStack,
    Types.Operation.StartStack,
    Types.Operation.RestartStack,
    Types.Operation.PauseStack,
    Types.Operation.UnpauseStack,
    Types.Operation.StopStack,
    Types.Operation.DestroyStack,
    Types.Operation.StartStackService,
    Types.Operation.RestartStackService,
    Types.Operation.PauseStackService,
    Types.Operation.UnpauseStackService,
    Types.Operation.StopStackService,
  ],
  Deployment: [
    Types.Operation.CreateDeployment,
    Types.Operation.UpdateDeployment,
    Types.Operation.DeleteDeployment,
    Types.Operation.Deploy,
    Types.Operation.StartDeployment,
    Types.Operation.RestartDeployment,
    Types.Operation.PauseDeployment,
    Types.Operation.UnpauseDeployment,
    Types.Operation.StopDeployment,
    Types.Operation.DestroyDeployment,
    Types.Operation.RenameDeployment,
  ],
  Build: [
    Types.Operation.CreateBuild,
    Types.Operation.UpdateBuild,
    Types.Operation.DeleteBuild,
    Types.Operation.RunBuild,
    Types.Operation.CancelBuild,
  ],
  Repo: [
    Types.Operation.CreateRepo,
    Types.Operation.UpdateRepo,
    Types.Operation.DeleteRepo,
    Types.Operation.CloneRepo,
    Types.Operation.PullRepo,
    Types.Operation.BuildRepo,
    Types.Operation.CancelRepoBuild,
  ],
  Procedure: [
    Types.Operation.CreateProcedure,
    Types.Operation.UpdateProcedure,
    Types.Operation.DeleteProcedure,
    Types.Operation.RunProcedure,
  ],
  Builder: [
    Types.Operation.CreateBuilder,
    Types.Operation.UpdateBuilder,
    Types.Operation.DeleteBuilder,
  ],
  Alerter: [
    Types.Operation.CreateAlerter,
    Types.Operation.UpdateAlerter,
    Types.Operation.DeleteAlerter,
  ],
  ResourceSync: [
    Types.Operation.CreateResourceSync,
    Types.Operation.UpdateResourceSync,
    Types.Operation.DeleteResourceSync,
    Types.Operation.CommitSync,
    Types.Operation.RunSync,
  ],
};
