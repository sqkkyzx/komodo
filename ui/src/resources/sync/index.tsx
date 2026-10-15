import { displayLabel } from "@/lib/l10n";
import { resourceSyncStateIntention } from "@/lib/color";
import { useListItem, useRead } from "@/lib/hooks";
import { ICONS } from "@/lib/icons";
import { Types } from "komodo_client";
import { fmtDate, StatusBadge } from "mogh_ui";
import ResourceSyncTable from "./table";
import { RequiredResourceComponents } from "@/resources";
import NewResource from "@/resources/new";
import { CommitSync, ExecuteSync, RefreshSync } from "./executions";
import FileSource from "@/components/file-source";
import { Clock } from "lucide-react";
import { Box, Group } from "@mantine/core";
import HashCompare from "@/components/hash-compare";
import ResourceSyncTabs from "./tabs";
import ResourceHeader from "../header";
import BatchExecutions from "@/resources/batch-executions";
import { hexColorByIntention } from "mogh_ui";

export function useResourceSync(
  id: string | undefined,
  useName?: boolean,
  refetchInterval?: number | false,
) {
  return useListItem("ResourceSync", id, useName, refetchInterval);
}

export function useFullResourceSync(id: string) {
  return useRead("GetResourceSync", { sync: id }, { refetchInterval: 30_000 })
    .data;
}

export const ResourceSyncComponents: RequiredResourceComponents<
  Types.ResourceSyncConfig,
  Types.ResourceSyncInfo,
  Types.ResourceSyncListItemInfo,
  Types.ResourceSyncQuerySpecifics
> = {
  useList: (query, limit, page) =>
    useRead("ListResourceSyncs", { query, limit, page }).data,
  useListItem: useResourceSync,
  useFull: useFullResourceSync,

  useResourceLinks: () => undefined,

  useDashboardSummaryData: () => {
    const summary = useRead(
      "GetResourceSyncsSummary",
      {},
      { refetchInterval: 10_000 },
    ).data;
    return [
      { title: "正常", intention: "Good", value: summary?.ok ?? 0 },
      {
        title: "同步中",
        intention: "Warning",
        value: summary?.syncing ?? 0,
      },
      {
        title: "待处理",
        intention: "Neutral",
        value: summary?.pending ?? 0,
      },
      {
        title: "失败",
        intention: "Critical",
        value: summary?.failed ?? 0,
      },
      {
        title: "未知",
        intention: "Unknown",
        value: summary?.unknown ?? 0,
      },
    ];
  },

  Description: () => <>通过 TOML 文件声明资源。</>,

  New: ({ repoId }) => (
    <NewResource
      type="ResourceSync"
      readableType="Sync"
      config={() => ({ linked_repo: repoId })}
    />
  ),

  BatchExecutions: () => (
    <BatchExecutions
      type="ResourceSync"
      executions={[
        ["RunSync", ICONS.Run],
        ["CommitSync", ICONS.Commit],
      ]}
    />
  ),

  Table: ResourceSyncTable,

  Icon: ({ id, size = "1rem", noColor }) => {
    const state = useResourceSync(id)?.info.state;
    const color = noColor
      ? undefined
      : state && hexColorByIntention(resourceSyncStateIntention(state));
    return <ICONS.ResourceSync size={size} color={color} />;
  },

  ResourcePageHeader: ({ id }) => {
    const resourceSync = useResourceSync(id);
    return (
      <ResourceHeader
        type="ResourceSync"
        id={id}
        resource={resourceSync}
        intent={resourceSyncStateIntention(resourceSync?.info.state)}
        icon={ICONS.ResourceSync}
        name={resourceSync?.name}
        state={resourceSync?.info.state}
      />
    );
  },

  State: ({ id }) => {
    let state = useResourceSync(id)?.info.state;
    return (
      <StatusBadge text={displayLabel(state)} intent={resourceSyncStateIntention(state)} />
    );
  },

  Info: {
    Source: ({ id }) => {
      const info = useResourceSync(id)?.info;
      return <FileSource info={info} />;
    },
    LastSync: ({ id }) => {
      const last_ts = useResourceSync(id)?.info.last_sync_ts;
      return (
        <Group gap="xs">
          <Clock size="1rem" />
          {last_ts ? fmtDate(new Date(last_ts)) : "从未"}
        </Group>
      );
    },
    Hash: ({ id }) => {
      const info = useFullResourceSync(id)?.info;
      if (!info?.pending_hash) {
        return null;
      }
      return (
        <Box>
          <HashCompare
            lastHash={info?.last_sync_hash}
            lastMessage={info?.last_sync_message}
            lastLabel="同步"
            latestHash={info?.pending_hash}
            latestMessage={info?.pending_message}
          />
        </Box>
      );
    },
  },

  Executions: {
    RefreshSync,
    ExecuteSync: ExecuteSync,
    CommitSync,
  },

  Config: ResourceSyncTabs,

  Page: {},
};
