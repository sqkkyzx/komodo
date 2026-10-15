import { displayLabel } from "@/lib/l10n";
import { useSearchCombobox } from "mogh_ui";
import { useInvalidate, useWrite } from "@/lib/hooks";
import { filterBySplit } from "mogh_ui";
import { ICONS } from "@/lib/icons";
import {
  Box,
  Button,
  Combobox,
  ComboboxProps,
  Group,
  Text,
} from "@mantine/core";
import { Types } from "komodo_client";

export interface TagColorSelectorProps extends ComboboxProps {
  tagId: string;
  color: Types.TagColor;
  disabled: boolean;
}

export default function TagColorSelector({
  tagId,
  color,
  disabled,
  ...comboboxProps
}: TagColorSelectorProps) {
  const { search, setSearch, combobox } = useSearchCombobox();
  const filtered = filterBySplit(
    Object.values(Types.TagColor),
    search,
    (item) => `${item} ${displayLabel(item)}`,
  );

  const inv = useInvalidate();
  const { mutateAsync: updateColor, isPending } = useWrite("UpdateTagColor", {
    onSuccess: () => {
      inv(["ListTags"]);
    },
  });

  return (
    <Combobox
      store={combobox}
      width={200}
      onOptionSubmit={(color) => {
        updateColor({ tag: tagId, color: color as Types.TagColor });
        combobox.closeDropdown();
      }}
      disabled={disabled}
      {...comboboxProps}
    >
      <Combobox.Target>
        <Button
          onClick={() => combobox.toggleDropdown()}
          rightSection={<Box w={25} h={25} bg={"Tag" + color} bdrs="md" />}
          loading={isPending}
          w={200}
          justify="space-between"
        >
          {displayLabel(color)}
        </Button>
      </Combobox.Target>
      <Combobox.Dropdown>
        <Combobox.Search
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          leftSection={<ICONS.Search size="1rem" />}
          placeholder="搜索"
          styles={{
            section: {
              marginRight: 4,
            },
          }}
        />
        <Combobox.Options mah={224} style={{ overflowY: "auto" }}>
          {filtered.map((color) => (
            <Combobox.Option key={color} value={color}>
              <Group justify="space-between">
                <Text>{displayLabel(color)}</Text>
                <Box w={25} h={25} bg={`Tag${color}.9`} bdrs="md" />
              </Group>
            </Combobox.Option>
          ))}
          {filtered.length === 0 && (
            <Combobox.Empty>无匹配结果。</Combobox.Empty>
          )}
        </Combobox.Options>
      </Combobox.Dropdown>
    </Combobox>
  );
}
