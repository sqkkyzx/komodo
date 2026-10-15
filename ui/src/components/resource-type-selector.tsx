import { resourceLabel } from "@/lib/l10n";
import { RESOURCE_TARGETS, UsableResource } from "@/resources";
import { Select, SelectProps } from "@mantine/core";

export interface ResourceTypeSelectorProps extends Omit<
  SelectProps,
  "onChange"
> {
  value: UsableResource | null;
  onChange?: (type: UsableResource | null) => void;
}

export default function ResourceTypeSelector({
  value,
  onChange,
  ...selectProps
}: ResourceTypeSelectorProps) {
  return (
    <Select
      placeholder="选择资源类型"
      value={value}
      onChange={(type) => {
        onChange?.(type as UsableResource);
      }}
      data={RESOURCE_TARGETS.map((value) => ({
        value,
        label: resourceLabel(value),
      }))}
      w={{ base: "100%", xs: 200 }}
      searchable
      clearable
      {...selectProps}
    />
  );
}
