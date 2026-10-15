import { Select, SelectProps, TextInput } from "@mantine/core";
import { useState } from "react";

export interface OrganizationSelectorProps extends Omit<
  SelectProps,
  "onSelect"
> {
  organizations: string[];
  selected: string;
  onSelect: (organization: string) => void;
  disabled: boolean;
  showLabel?: boolean;
}

export default function OrganizationSelector({
  organizations,
  selected,
  onSelect,
  disabled,
  showLabel,
  ...selectorProps
}: OrganizationSelectorProps) {
  const [customMode, setCustomMode] = useState(false);

  if (customMode) {
    return (
      <TextInput
        label="组织"
        placeholder="输入自定义组织名称"
        w={{ base: "85%", lg: 400 }}
        value={selected}
        onChange={(e) => onSelect(e.target.value)}
        onBlur={() => setCustomMode(false)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            setCustomMode(false);
          }
        }}
        autoFocus
      />
    );
  }

  const orgSet = new Set<string>();
  selected && orgSet.add(selected);
  for (const org of organizations) {
    orgSet.add(org);
  }
  const orgs = ["None", ...orgSet, "Custom"];
  orgs.sort();

  return (
    <Select
      placeholder="选择组织"
      label={showLabel && "组织"}
      value={selected}
      disabled={disabled}
      data={orgs.map((value) => ({
        value,
        label: value === "None" ? "无" : value === "Custom" ? "自定义" : value,
      }))}
      onChange={(value) => {
        if (value === "Custom") {
          onSelect("");
          setCustomMode(true);
        } else if (value === "None") {
          onSelect("");
        } else if (value) {
          onSelect(value);
        }
      }}
      searchable
      {...selectorProps}
    />
  );
}
