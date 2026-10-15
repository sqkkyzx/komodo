import { displayLabel, resourceLabel } from "@/lib/l10n";
import {
  actionStateIntention,
  buildStateIntention,
  deploymentStateIntention,
  procedureStateIntention,
  repoStateIntention,
  stackStateIntention,
} from "@/lib/color";
import { useRead } from "@/lib/hooks";
import ResourceLink from "@/resources/link";
import { ICONS } from "@/lib/icons";
import { DataTable, hexColorByIntention, SortableHeader } from "mogh_ui";
import { Section } from "mogh_ui";
import { StatusBadge } from "mogh_ui";
import { Group } from "@mantine/core";
import { Types } from "komodo_client";
import { Circle } from "lucide-react";
import { ReactNode } from "react";

export default function DashboardActiveResources() {
  const stacks =
    useRead(
      "ListStacks",
      {
        query: {
          specific: {
            states: [
              Types.StackState.Deploying,
              Types.StackState.Restarting,
              Types.StackState.Removing,
            ],
          },
        },
        limit: 0,
      },
      { refetchInterval: 10_000 },
    ).data ?? [];
  const deployments =
    useRead(
      "ListDeployments",
      {
        query: {
          specific: {
            states: [
              Types.DeploymentState.Deploying,
              Types.DeploymentState.Restarting,
              Types.DeploymentState.Removing,
            ],
          },
        },
        limit: 0,
      },
      { refetchInterval: 10_000 },
    ).data ?? [];
  const builds =
    useRead(
      "ListBuilds",
      {
        query: {
          specific: { states: [Types.BuildState.Building] },
        },
        limit: 0,
      },
      { refetchInterval: 10_000 },
    ).data ?? [];
  const repos =
    useRead(
      "ListRepos",
      {
        query: {
          specific: {
            states: [
              Types.RepoState.Building,
              Types.RepoState.Cloning,
              Types.RepoState.Pulling,
            ],
          },
        },
        limit: 0,
      },
      { refetchInterval: 10_000 },
    ).data ?? [];
  const procedures =
    useRead(
      "ListProcedures",
      {
        query: {
          specific: { states: [Types.ProcedureState.Running] },
        },
        limit: 0,
      },
      { refetchInterval: 10_000 },
    ).data ?? [];
  const actions =
    useRead(
      "ListActions",
      {
        query: {
          specific: { states: [Types.ActionState.Running] },
        },
        limit: 0,
      },
      { refetchInterval: 10_000 },
    ).data ?? [];
  const globalAutoUpdates =
    useRead("ListUpdates", {
      query: {
        operation: Types.Operation.GlobalAutoUpdate,
        status: Types.UpdateStatus.InProgress,
      },
    }).data?.updates ?? [];

  const resources: {
    type: Types.ResourceTarget["type"];
    id: string;
    label?: string;
    state: ReactNode;
  }[] = [
    ...stacks.map((stack) => ({
      type: "Stack" as Types.ResourceTarget["type"],
      id: stack.id,
      state: (
        <StatusBadge
          text={displayLabel(stack.info.state)}
          intent={stackStateIntention(
            stack.info.state,
            stack.info.services &&
              !stack.info.services.every(
                (service) => !service.update_available,
              ),
          )}
        />
      ),
    })),
    ...deployments.map((deployment) => ({
      type: "Deployment" as Types.ResourceTarget["type"],
      id: deployment.id,
      state: (
        <StatusBadge
          text={displayLabel(deployment.info.state)}
          intent={deploymentStateIntention(
            deployment.info.state,
            deployment.info.update_available,
          )}
        />
      ),
    })),
    ...builds.map((build) => ({
      type: "Build" as Types.ResourceTarget["type"],
      id: build.id,
      state: (
        <StatusBadge
          text={displayLabel(build.info.state)}
          intent={buildStateIntention(build.info.state)}
        />
      ),
    })),
    ...repos.map((repo) => ({
      type: "Repo" as Types.ResourceTarget["type"],
      id: repo.id,
      state: (
        <StatusBadge
          text={displayLabel(repo.info.state)}
          intent={repoStateIntention(repo.info.state)}
        />
      ),
    })),
    ...procedures.map((procedure) => ({
      type: "Procedure" as Types.ResourceTarget["type"],
      id: procedure.id,
      state: (
        <StatusBadge
          text={displayLabel(procedure.info.state)}
          intent={procedureStateIntention(procedure.info.state)}
        />
      ),
    })),
    ...actions.map((action) => ({
      type: "Action" as Types.ResourceTarget["type"],
      id: action.id,
      state: (
        <StatusBadge
          text={displayLabel(action.info.state)}
          intent={actionStateIntention(action.info.state)}
        />
      ),
    })),
    ...globalAutoUpdates.map((update) => ({
      type: "System" as Types.ResourceTarget["type"],
      id: update.id,
      label: "全局自动更新",
      state: (
        <StatusBadge
          text={displayLabel(Types.ActionState.Running)}
          intent={actionStateIntention(Types.ActionState.Running)}
        />
      ),
    })),
  ];

  if (resources.length === 0) return null;

  return (
    <Section
      title="活动任务"
      mb="xl"
      icon={
        <Circle
          size="1rem"
          stroke={hexColorByIntention("Good")}
          fill={hexColorByIntention("Good")}
        />
      }
    >
      <DataTable
        tableKey="active-resources"
        data={resources}
        columns={[
          {
            accessorKey: "name",
            header: ({ column }) => (
              <SortableHeader column={column} title="名称" />
            ),
            cell: ({ row }) =>
              row.original.type === "System" ? (
                <Group gap="xs">
                  <ICONS.System size="1rem" />
                  {row.original.label ?? "系统"}
                </Group>
              ) : (
                <ResourceLink type={row.original.type} id={row.original.id} />
              ),
          },
          {
            accessorKey: "type",
            cell: ({ row }) => resourceLabel(row.original.type),
            header: ({ column }) => (
              <SortableHeader column={column} title="资源" />
            ),
          },
          {
            header: "状态",
            cell: ({ row }) => row.original.state,
          },
        ]}
      />
    </Section>
  );
}
