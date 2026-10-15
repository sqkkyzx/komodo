import { displayLabel } from "@/lib/l10n";
import { stackStateIntention } from "@/lib/color";
import {
  useInvalidate,
  useListItem,
  usePermissions,
  useRead,
  useWrite,
} from "@/lib/hooks";
import { ICONS } from "@/lib/icons";
import { Types } from "komodo_client";
import { StatusBadge } from "mogh_ui";
import { RequiredResourceComponents } from "@/resources";
import StackTable from "./table";
import StackTabs from "./tabs";
import {
  DeployStack,
  DestroyStack,
  PauseUnpauseStack,
  PullStack,
  RestartStack,
  StartStopStack,
} from "./executions";
import { useSwarm } from "@/resources/swarm";
import { useServer } from "@/resources/server";
import {
  ActionIcon,
  Box,
  Button,
  Group,
  HoverCard,
  List,
  Text,
} from "@mantine/core";
import FileSource from "@/components/file-source";
import { ArrowUp } from "lucide-react";
import { notifications } from "@mantine/notifications";
import ResourceLink from "@/resources/link";
import HashCompare from "@/components/hash-compare";
import StackUpdateAvailable from "./update-available";
import ResourceHeader from "../header";
import BatchExecutions from "@/resources/batch-executions";
import NewResourceWithDeployTarget from "../new-with-deploy-target";
import { hexColorByIntention } from "mogh_ui";

export function useStack(
  id: string | undefined,
  useName?: boolean,
  refetchInterval?: number | false,
) {
  return useListItem("Stack", id, useName, refetchInterval);
}

export function useFullStack(id: string) {
  return useRead("GetStack", { stack: id }, { refetchInterval: 30_000 }).data;
}

export const StackComponents: RequiredResourceComponents<
  Types.StackConfig,
  Types.StackInfo,
  Types.StackListItemInfo,
  Types.StackQuerySpecifics
> = {
  useList: (query, limit, page) =>
    useRead("ListStacks", { query, limit, page }).data,
  useListItem: useStack,
  useFull: useFullStack,

  useResourceLinks: (stack) => stack?.config?.links,

  useDashboardSummaryData: () => {
    const summary = useRead(
      "GetStacksSummary",
      {},
      { refetchInterval: 10_000 },
    ).data;
    const all = [
      summary?.running ?? 0,
      summary?.stopped ?? 0,
      summary?.unhealthy ?? 0,
      summary?.unknown ?? 0,
    ];
    const [running, stopped, unhealthy, unknown] = all;
    return [
      all.every((item) => item === 0) && {
        title: "未运行",
        intention: "Neutral",
        value: summary?.down ?? 0,
      },
      { intention: "Good", value: running, title: "运行中" },
      {
        intention: "Warning",
        value: stopped,
        title: "已停止",
      },
      {
        intention: "Critical",
        value: unhealthy,
        title: "不健康",
      },
      {
        intention: "Unknown",
        value: unknown,
        title: "未知",
      },
    ];
  },

  Description: () => <>部署 Docker Compose 文件。</>,

  New: (props) => <NewResourceWithDeployTarget type="Stack" {...props} />,

  BatchExecutions: () => (
    <BatchExecutions
      type="Stack"
      executions={[
        ["CheckStackForUpdate", ICONS.UpdateAvailable],
        ["PullStack", ICONS.Pull],
        ["DeployStack", ICONS.Deploy],
        ["RestartStack", ICONS.Restart],
        ["StopStack", ICONS.Stop],
        ["DestroyStack", ICONS.Destroy],
      ]}
    />
  ),

  Table: StackTable,

  Icon: ({ id, size = "1rem", noColor }) => {
    const info = useStack(id)?.info;
    const color = noColor
      ? undefined
      : info &&
        hexColorByIntention(
          stackStateIntention(
            info.state,
            info.services &&
              !info.services.every((service) => !service.update_available),
          ),
        );
    return <ICONS.Stack size={size} color={color} />;
  },

  ResourcePageHeader: ({ id }) => {
    const stack = useStack(id);
    return (
      <ResourceHeader
        type="Stack"
        id={id}
        resource={stack}
        intent={stackStateIntention(
          stack?.info.state,
          stack?.info.services &&
            !stack?.info.services.every((service) => !service.update_available),
        )}
        icon={ICONS.Stack}
        name={stack?.name}
        state={stack?.info.state}
        status={
          stack?.info.state === Types.StackState.Unhealthy
            ? stack?.info.status
            : undefined
        }
      />
    );
  },

  State: ({ id }) => {
    let info = useStack(id)?.info;
    return (
      <StatusBadge
        text={displayLabel(info?.state)}
        intent={stackStateIntention(
          info?.state,
          info?.services &&
            !info.services.every((service) => !service.update_available),
        )}
      />
    );
  },
  Info: {
    DeployTarget: ({ id }) => {
      const info = useStack(id)?.info;
      const swarm = useSwarm(info?.swarm_id);
      const server = useServer(info?.server_id);
      return swarm?.id ? (
        <ResourceLink type="Swarm" id={swarm?.id} />
      ) : server?.id ? (
        <ResourceLink type="Server" id={server?.id} />
      ) : (
        <Group gap="xs">
          <ICONS.Server size="1rem" />
          <Text>未知</Text>
        </Group>
      );
    },
    Source: ({ id }) => {
      const info = useStack(id)?.info;
      return <FileSource info={info} />;
    },
    Services: ({ id }) => {
      const info = useStack(id)?.info;
      return (
        <HoverCard position="bottom-start">
          <HoverCard.Target>
            <Text>
              <b>{info?.services.length}</b> 个服务
            </Text>
          </HoverCard.Target>
          <HoverCard.Dropdown>
            <List>
              {info?.services.map((service) => (
                <List.Item key={service.service}>
                  <Group gap="xs">
                    <Text>{service.service}</Text>
                    <Text c="dimmed">-</Text>
                    <Text c="dimmed">{service.image}</Text>
                    {service.update_available && (
                      <ActionIcon color="cyan" size="xs">
                        <ArrowUp size="0.9rem" />
                      </ActionIcon>
                    )}
                  </Group>
                </List.Item>
              ))}
            </List>
          </HoverCard.Dropdown>
        </HoverCard>
      );
    },

    UpdateAvalable: StackUpdateAvailable,
    Hash: ({ id }) => {
      const fullInfo = useFullStack(id)?.info;
      const info = useStack(id)?.info;
      const state = info?.state;
      const stackDown =
        state === undefined ||
        state === Types.StackState.Unknown ||
        state === Types.StackState.Down;
      if (
        stackDown ||
        info?.project_missing ||
        !info?.latest_hash ||
        !fullInfo
      ) {
        return null;
      }
      return (
        // The border is added to the box.
        <Box>
          <HashCompare
            lastHash={fullInfo?.deployed_hash}
            lastMessage={fullInfo?.deployed_message}
            lastLabel="部署"
            latestHash={fullInfo?.latest_hash}
            latestMessage={fullInfo?.latest_message}
          />
        </Box>
      );
    },
    NoConfig: ({ id }) => {
      const config = useFullStack(id)?.config;
      if (
        !config ||
        config?.files_on_host ||
        config?.file_contents ||
        config?.linked_repo ||
        config?.repo
      ) {
        return null;
      }
      return (
        <Box>
          <HoverCard width={300} position="bottom-start">
            <HoverCard.Target>
              <Button variant="filled" color="red">
                缺少配置
              </Button>
            </HoverCard.Target>
            <HoverCard.Dropdown>
              <Text>
                应用栈未提供配置，无法获取状态。请在界面中粘贴 Compose 文件内容，或配置包含文件的 Git 仓库。
              </Text>
            </HoverCard.Dropdown>
          </HoverCard>
        </Box>
      );
    },
    ProjectMissing: ({ id }) => {
      const info = useStack(id)?.info;
      const state = info?.state ?? Types.StackState.Unknown;
      if (
        !info ||
        !info?.project_missing ||
        [
          Types.StackState.Deploying,
          Types.StackState.Down,
          Types.StackState.Unknown,
        ].includes(state)
      ) {
        return null;
      }
      return (
        <Box>
          <HoverCard width={300} position="bottom-start">
            <HoverCard.Target>
              <Button variant="filled" color="red">
                缺少项目
              </Button>
            </HoverCard.Target>
            <HoverCard.Dropdown>
              <Text>
                主机上未找到此 Compose 项目。若应用栈正在运行，请设置“项目名称”，可使用 docker compose ls 查询。
              </Text>
            </HoverCard.Dropdown>
          </HoverCard>
        </Box>
      );
    },
    RemoteErrors: ({ id }) => {
      const info = useFullStack(id)?.info;
      const errors = info?.remote_errors;
      if (!info || !errors || errors.length === 0) {
        return null;
      }
      return (
        <Box>
          <HoverCard width={300} position="bottom-start">
            <HoverCard.Target>
              <Button variant="filled" color="red">
                远程错误
              </Button>
            </HoverCard.Target>
            <HoverCard.Dropdown>
              <Text>
                读取远程文件内容时出错。请查看{" "}
                <b>信息</b> 选项卡了解详情。
              </Text>
            </HoverCard.Dropdown>
          </HoverCard>
        </Box>
      );
    },
    Refresh: ({ id }) => {
      const inv = useInvalidate();
      const info = useStack(id)?.info;
      const { canExecute } = usePermissions({ type: "Stack", id });
      const { mutate, isPending } = useWrite("RefreshStackCache", {
        onSuccess: () => {
          inv(["ListStacks"], ["GetStack", { stack: id }]);
          notifications.show({ message: "已刷新源文件内容" });
        },
      });

      if (
        !canExecute ||
        // Don't show for UI defined, doesn't do anything
        (!info?.files_on_host && !info?.linked_repo && !info?.repo)
      )
        return null;

      return (
        <ActionIcon onClick={() => mutate({ stack: id })} loading={isPending}>
          <ICONS.Refresh size="1rem" />
        </ActionIcon>
      );
    },
  },

  Executions: {
    DeployStack,
    PullStack,
    RestartStack,
    PauseUnpauseStack,
    StartStopStack,
    DestroyStack,
  },

  Config: StackTabs,

  Page: {},
};

export const DEFAULT_STACK_FILE_CONTENTS = `## Add your compose file here
services:
  hello_world:
    image: hello-world
    # networks:
    #   - default
    # ports:
    #   - 3000:3000
    # volumes:
    #   - data:/data

# networks:
#   default: {}

# volumes:
#   data:
`;
