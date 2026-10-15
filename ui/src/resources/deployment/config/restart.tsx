import { displayLabel } from "@/lib/l10n";
import { ConfigItem } from "mogh_ui";
import { Select } from "@mantine/core";
import { Types } from "komodo_client";

export interface DeploymentRestartSelectorProps {
  selected: Types.RestartMode | undefined;
  set: (input: Partial<Types.DeploymentConfig>) => void;
  disabled: boolean;
}

export default function DeploymentRestartSelector({
  selected,
  set,
  disabled,
}: DeploymentRestartSelectorProps) {
  return (
    <ConfigItem
      label="重启策略"
      description="配置 --restart 重启策略。"
    >
      <Select
        value={selected || undefined}
        onChange={(restart) =>
          restart && set({ restart: restart as Types.RestartMode })
        }
        disabled={disabled}
        placeholder="选择模式"
        data={Object.entries(Types.RestartMode).map(([label, value]) => ({
          label: displayLabel(label),
          value,
        }))}
        tt="capitalize"
        w={{ base: "100%", xs: "fit-content" }}
      />
    </ConfigItem>
  );
}
