import { displayLabel } from "@/lib/l10n";
import { ICONS } from "@/lib/icons";
import { ConfigItem } from "mogh_ui";
import { Badge, Group, Select } from "@mantine/core";
import { Types } from "komodo_client";

const ALERT_TYPES: Types.AlertData["type"][] = [
  // Server
  "ServerVersionMismatch",
  "ServerUnreachable",
  "ServerCpu",
  "ServerMem",
  "ServerDisk",
  // Swarm
  "SwarmUnhealthy",
  // Stack
  "StackStateChange",
  "StackImageUpdateAvailable",
  "StackAutoUpdated",
  // Deployment
  "ContainerStateChange",
  "DeploymentImageUpdateAvailable",
  "DeploymentAutoUpdated",
  // Misc
  "ScheduleRun",
  "BuildFailed",
  "ResourceSyncPendingUpdates",
  "RepoBuildFailed",
  "ActionFailed",
  "ProcedureFailed",
  "AwsBuilderTerminationFailed",
  "Custom",
] as const;

export default function AlerterConfigAlertTypes({
  alertTypes,
  set,
  disabled,
}: {
  alertTypes: Types.AlertData["type"][];
  set: (alertTypes: Types.AlertData["type"][]) => void;
  disabled: boolean;
}) {
  return (
    <ConfigItem
      label="告警类型"
      description="仅发送指定类型的告警。"
    >
      <Group wrap="nowrap">
        <Select
          placeholder="添加筛选条件"
          value={null}
          onChange={(type) =>
            set([...alertTypes, type as Types.AlertData["type"]])
          }
          w={300}
          data={ALERT_TYPES.filter(
            (alert_type) => !alertTypes.includes(alert_type),
          ).map((type) => ({ value: type, label: displayLabel(type) }))}
          searchable
        />
        <Group>
          {alertTypes.map((type) => (
            <Badge
              style={{ cursor: "pointer" }}
              onClick={() => {
                if (disabled) return;
                set(alertTypes.filter((t) => t !== type));
              }}
              rightSection={<ICONS.Remove size="1rem" color="red" />}
              size="lg"
            >
              {displayLabel(type)}
            </Badge>
          ))}
        </Group>
      </Group>
    </ConfigItem>
  );
}
