import { serverStateIntention } from "@/lib/color";
import { useExecute, useListItem, useRead } from "@/lib/hooks";
import { ICONS } from "@/lib/icons";
import { RequiredResourceComponents } from "..";
import { Types } from "komodo_client";
import { StatusBadge } from "mogh_ui";
import ServerTable from "./table";
import NewResource from "@/resources/new";
import { ConfirmButton, hexColorByIntention } from "mogh_ui";
import { Prune } from "./executions";
import ServerVersion from "./version";
import { Box, Group, HoverCard } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import ConfirmServerPubkey from "./confirm-pubkey";
import ServerTabs from "./tabs";
import { displayLabel } from "@/lib/l10n";
import ConfirmModalWithDisable from "@/components/confirm-modal-with-disable";
import ResourceHeader from "../header";
import { useIsServerAvailable } from "./hooks";
import BatchExecutions from "@/resources/batch-executions";
import { ServerLoadAverage } from "./stats/current/load-average";
import { ServerRamUsage } from "./stats/current/ram";
import ServerDiskUsage from "./diskUsage";
import ServerCpuUsage from "./stats/current/cpu";
import { HoverError } from "mogh_ui";

export function useServer(
  id: string | undefined,
  useName?: boolean,
  refetchInterval?: number | false,
) {
  return useListItem("Server", id, useName, refetchInterval);
}

export function useFullServer(id: string | undefined) {
  return useRead(
    "GetServer",
    { server: id! },
    { refetchInterval: 30_000, enabled: !!id },
  ).data;
}

export const ServerComponents: RequiredResourceComponents<
  Types.ServerConfig,
  Types.ServerInfo,
  Types.ServerListItemInfo,
  Types.ServerQuerySpecifics
> = {
  useList: (query, limit, page) =>
    useRead("ListServers", { query, limit, page }).data,
  useListItem: useServer,
  useFull: useFullServer,

  useResourceLinks: (server) => server?.config?.links,

  useDashboardSummaryData: () => {
    const summary = useRead(
      "GetServersSummary",
      {},
      { refetchInterval: 10_000 },
    ).data;
    return [
      { title: "健康", intention: "Good", value: summary?.healthy ?? 0 },
      {
        title: "警告",
        intention: "Warning",
        value: summary?.warning ?? 0,
      },
      {
        title: "不健康",
        intention: "Critical",
        value: summary?.unhealthy ?? 0,
      },
      {
        title: "已禁用",
        intention: "Neutral",
        value: summary?.disabled ?? 0,
      },
    ];
  },

  Description: () => (
    <>连接服务器，用于告警、构建和部署。</>
  ),

  New: () => <NewResource type="Server" />,

  BatchExecutions: () => (
    <BatchExecutions
      type="Server"
      executions={[
        ["PruneContainers", ICONS.Container],
        ["PruneNetworks", ICONS.Network],
        ["PruneVolumes", ICONS.Volume],
        ["PruneImages", ICONS.Image],
        ["PruneSystem", ICONS.System],
        ["RestartAllContainers", ICONS.Restart],
        ["StopAllContainers", ICONS.Stop],
      ]}
    />
  ),

  Table: ServerTable,

  Icon: ({ id, size = "1rem", noColor }) => {
    const coreVersion = useRead("GetVersion", {}).data?.version;
    const info = useServer(id)?.info;
    const state = info?.state;
    const color = noColor
      ? undefined
      : state &&
        hexColorByIntention(
          serverStateIntention(
            state,
            (info.version && coreVersion && info.version !== coreVersion) ||
              false,
          ),
        );
    return <ICONS.Server size={size} color={color} />;
  },

  ResourcePageHeader: ({ id }) => {
    const coreVersion = useRead("GetVersion", {}).data?.version;
    const server = useServer(id);
    const versionMismatch =
      !!coreVersion &&
      !!server?.info.version &&
      coreVersion !== server.info.version;
    return (
      <ResourceHeader
        type="Server"
        id={id}
        resource={server}
        intent={serverStateIntention(
          server?.info.state,
          !!coreVersion &&
            !!server?.info.version &&
            coreVersion !== server.info.version,
        )}
        icon={ICONS.Server}
        name={server?.name}
        state={
          server?.info.state === Types.ServerState.Ok && versionMismatch
            ? "版本不匹配"
            : displayLabel(server?.info.state ?? "")
        }
        status={server?.info.region}
      />
    );
  },

  State: ({ id }) => {
    const coreVersion = useRead("GetVersion", {}).data?.version;
    const info = useServer(id)?.info;
    return (
      <StatusBadge
        text={displayLabel(info?.state)}
        intent={serverStateIntention(
          info?.state,
          !!coreVersion && !!info?.version && coreVersion !== info.version,
        )}
      />
    );
  },
  Info: {
    ServerVersion,
    PublicIp: ({ id }) => {
      const publicIp = useServer(id)?.info.public_ip;
      return (
        <HoverCard position="bottom-start">
          <HoverCard.Target>
            <Group
              gap="xs"
              onClick={() => {
                publicIp &&
                  navigator.clipboard
                    .writeText(publicIp)
                    .then(() =>
                      notifications.show({ message: "已复制公网 IP" }),
                    );
              }}
              style={{ cursor: "pointer" }}
            >
              <ICONS.IP size="1rem" />
              {publicIp ?? "未知 IP"}
            </Group>
          </HoverCard.Target>
          <HoverCard.Dropdown>公网 IP（点击复制）</HoverCard.Dropdown>
        </HoverCard>
      );
    },
    Cpu: ({ id }) => {
      const isServerAvailable = useIsServerAvailable(id);
      const coreCount =
        useRead(
          "GetSystemInformation",
          { server: id },
          {
            enabled: isServerAvailable,
          },
        ).data?.core_count ?? 0;
      return (
        <HoverCard position="bottom-start">
          <HoverCard.Target>
            <Group gap="xs">
              <ICONS.Cpu size="1rem" />
              {coreCount
                ? `${coreCount} 核心`
                : "不适用"}
            </Group>
          </HoverCard.Target>
          <HoverCard.Dropdown>
            <ServerCpuUsage id={id} />
          </HoverCard.Dropdown>
        </HoverCard>
      );
    },
    LoadAvg: ({ id }) => {
      const isServerAvailable = useIsServerAvailable(id);
      const stats = useRead(
        "GetSystemStats",
        { server: id },
        {
          enabled: isServerAvailable,
          refetchInterval: 5_000,
        },
      ).data;

      const one = stats?.load_average?.one;

      return (
        <HoverCard position="bottom-start">
          <HoverCard.Target>
            <Group gap="xs">
              <ICONS.LoadAvg size="1rem" />
              {one?.toFixed(2) ?? "不适用"}
            </Group>
          </HoverCard.Target>
          <HoverCard.Dropdown>
            <ServerLoadAverage id={id} stats={stats} />
          </HoverCard.Dropdown>
        </HoverCard>
      );
    },
    Memory: ({ id }) => {
      const isServerAvailable = useIsServerAvailable(id);
      const stats = useRead(
        "GetSystemStats",
        { server: id },
        {
          enabled: isServerAvailable,
          refetchInterval: 5_000,
        },
      ).data;
      return (
        <HoverCard position="bottom-start">
          <HoverCard.Target>
            <Group gap="xs">
              <ICONS.Memory size="1rem" />
              {stats?.mem_total_gb.toFixed(2).concat(" GB") ?? "不适用"}
            </Group>
          </HoverCard.Target>
          <HoverCard.Dropdown>
            <ServerRamUsage id={id} stats={stats} />
          </HoverCard.Dropdown>
        </HoverCard>
      );
    },
    Disk: ({ id }) => {
      const isServerAvailable = useIsServerAvailable(id);
      const stats = useRead(
        "GetSystemStats",
        { server: id },
        {
          enabled: isServerAvailable,
          refetchInterval: 5_000,
        },
      ).data;
      const diskTotalGb = stats?.disks.reduce(
        (acc, curr) => acc + curr.total_gb,
        0,
      );
      return (
        <HoverCard position="bottom-start">
          <HoverCard.Target>
            <Group gap="xs">
              <ICONS.Disk size="1rem" />
              {diskTotalGb?.toFixed(2).concat(" GB") ?? "不适用"}
            </Group>
          </HoverCard.Target>
          <HoverCard.Dropdown>
            <ServerDiskUsage id={id} stats={stats} withHeader />
          </HoverCard.Dropdown>
        </HoverCard>
      );
    },
    Err: ({ id }) => {
      const err = useServer(id)?.info.err;
      if (!err) return null;
      return (
        <Box>
          <HoverError {...err} />
        </Box>
      );
    },
    ConfirmServerPubkey,
  },

  Executions: {
    StartAll: ({ id }) => {
      const server = useServer(id);
      const { mutate, isPending } = useExecute("StartAllContainers");
      const starting = useRead(
        "GetServerActionState",
        { server: id },
        { refetchInterval: 5_000 },
      ).data?.starting_containers;
      const dontShow =
        useRead("ListContainers", {
          server: id,
        }).data?.every(
          (container) =>
            container.state === Types.ContainerStateStatusEnum.Running,
        ) ?? true;
      if (dontShow) {
        return null;
      }
      const pending = isPending || !!starting;
      return (
        server && (
          <ConfirmButton
            icon={<ICONS.Start size="1rem" />}
            onClick={() => mutate({ server: id })}
            loading={pending}
            disabled={pending}
          >
            启动容器
          </ConfirmButton>
        )
      );
    },
    RestartAll: ({ id }) => {
      const server = useServer(id);
      const { mutateAsync: restart, isPending } = useExecute(
        "RestartAllContainers",
      );
      const restarting = useRead(
        "GetServerActionState",
        { server: id },
        { refetchInterval: 5_000 },
      ).data?.restarting_containers;
      const pending = isPending || !!restarting;
      return (
        server && (
          <ConfirmModalWithDisable
            confirmText={server?.name}
            icon={<ICONS.Restart size="1rem" />}
            onConfirm={() => restart({ server: id })}
            disabled={pending}
            loading={pending}
          >
            重启容器
          </ConfirmModalWithDisable>
        )
      );
    },
    PauseAll: ({ id }) => {
      const server = useServer(id);
      const { mutateAsync: pause, isPending } =
        useExecute("PauseAllContainers");
      const pausing = useRead(
        "GetServerActionState",
        { server: id },
        { refetchInterval: 5_000 },
      ).data?.pausing_containers;
      const dontShow =
        useRead("ListContainers", {
          server: id,
        }).data?.every(
          (container) =>
            container.state !== Types.ContainerStateStatusEnum.Running,
        ) ?? true;
      if (dontShow) {
        return null;
      }
      const pending = isPending || !!pausing;
      return (
        server && (
          <ConfirmModalWithDisable
            confirmText={server?.name}
            icon={<ICONS.Pause size="1rem" />}
            onConfirm={() => pause({ server: id })}
            disabled={pending}
            loading={pending}
          >
            暂停容器
          </ConfirmModalWithDisable>
        )
      );
    },
    UnpauseAll: ({ id }) => {
      const server = useServer(id);
      const { mutateAsync: unpause, isPending } = useExecute(
        "UnpauseAllContainers",
      );
      const unpausing = useRead(
        "GetServerActionState",
        { server: id },
        { refetchInterval: 5_000 },
      ).data?.unpausing_containers;
      const dontShow =
        useRead("ListContainers", {
          server: id,
        }).data?.every(
          (container) =>
            container.state !== Types.ContainerStateStatusEnum.Paused,
        ) ?? true;
      if (dontShow) {
        return null;
      }
      const pending = isPending || !!unpausing;
      return (
        server && (
          <ConfirmButton
            icon={<ICONS.Start size="1rem" />}
            onClick={() => unpause({ server: id })}
            loading={pending}
            disabled={pending}
          >
            恢复容器
          </ConfirmButton>
        )
      );
    },
    StopAll: ({ id }) => {
      const server = useServer(id);
      const { mutateAsync: stop, isPending } = useExecute("StopAllContainers");
      const stopping = useRead(
        "GetServerActionState",
        { server: id },
        { refetchInterval: 5_000 },
      ).data?.stopping_containers;
      const pending = isPending || !!stopping;
      return (
        server && (
          <ConfirmModalWithDisable
            confirmText={server.name}
            icon={<ICONS.Stop size="1rem" />}
            onConfirm={() => stop({ server: id })}
            disabled={pending}
            loading={pending}
          >
            停止容器
          </ConfirmModalWithDisable>
        )
      );
    },
    PruneBuildx: ({ id }) => <Prune serverId={id} type="Buildx" />,
    PruneSystem: ({ id }) => <Prune serverId={id} type="System" />,
  },

  Config: ServerTabs,

  Page: {},
};
