import { displayLabel } from "@/lib/l10n";
import { listsEqual } from "@/lib/utils";
import { UsableResource } from "@/resources";
import { Box, MultiSelect, MultiSelectProps } from "@mantine/core";
import { Types } from "komodo_client";
import { useState } from "react";

const ALL_PERMISSIONS_BY_TYPE: {
  [type: string]: Types.SpecificPermission[] | undefined;
} = {
  Swarm: [
    Types.SpecificPermission.Attach,
    Types.SpecificPermission.Inspect,
    Types.SpecificPermission.Logs,
  ],
  Server: [
    Types.SpecificPermission.Attach,
    Types.SpecificPermission.Inspect,
    Types.SpecificPermission.Logs,
    Types.SpecificPermission.Terminal,
    Types.SpecificPermission.Processes,
  ],
  Stack: [
    Types.SpecificPermission.Inspect,
    Types.SpecificPermission.Logs,
    Types.SpecificPermission.Terminal,
  ],
  Deployment: [
    Types.SpecificPermission.Inspect,
    Types.SpecificPermission.Logs,
    Types.SpecificPermission.Terminal,
  ],
  Build: [Types.SpecificPermission.Attach],
  Repo: [Types.SpecificPermission.Attach],
  Builder: [Types.SpecificPermission.Attach],
};

export interface SpecificPermissionSelectorProps extends Omit<
  MultiSelectProps,
  "onChange"
> {
  type: UsableResource;
  specific: Types.SpecificPermission[];
  onChange: (specific: Types.SpecificPermission[]) => void;
}

export default function SpecificPermissionSelector({
  type,
  specific,
  onChange,
  ...props
}: SpecificPermissionSelectorProps) {
  const [temp, setTemp] = useState(specific);
  return (
    <Box w={550}>
      <MultiSelect
        placeholder={!temp.length ? "添加具体权限…" : undefined}
        value={temp}
        onChange={(specific) => setTemp(specific as Types.SpecificPermission[])}
        onBlur={() => !listsEqual(specific, temp) && onChange(temp)}
        onClear={() => {
          setTemp([]);
          onChange?.([]);
        }}
        data={ALL_PERMISSIONS_BY_TYPE[type]?.map((value) => ({
          value,
          label: displayLabel(value),
        }))}
        clearable
        maw={500}
        {...props}
      />
    </Box>
  );
}
