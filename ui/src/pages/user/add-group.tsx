import { useInvalidate, useRead, useWrite } from "@/lib/hooks";
import { filterBySplit } from "mogh_ui";
import { ICONS } from "@/lib/icons";
import { Button, Combobox, ComboboxProps, Group, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useSearchCombobox } from "mogh_ui";

export interface UserAddUserGroupProps extends ComboboxProps {
  userId: string;
}

export default function UserAddUserGroup({
  userId,
  position = "bottom-start",
  ...comboboxProps
}: UserAddUserGroupProps) {
  const { search, setSearch, combobox } = useSearchCombobox();

  const groups = useRead("ListUserGroups", {}).data?.filter(
    (group) =>
      // Only show groups which user is already a part of
      !group?.users?.includes(userId),
  );

  const inv = useInvalidate();
  const { mutate: addUser, isPending } = useWrite("AddUserToUserGroup", {
    onSuccess: () => {
      inv(["ListUserGroups"]);
      notifications.show({
        message: "已将用户添加到用户组",
        color: "green",
      });
    },
  });

  if (!groups || groups.length === 0) return null;

  const filtered = filterBySplit(groups, search, (item) => item.name);

  return (
    <Combobox
      store={combobox}
      width={300}
      position={position}
      onOptionSubmit={(user_group) => {
        combobox.closeDropdown();
        addUser({ user: userId, user_group });
      }}
      {...comboboxProps}
    >
      <Combobox.Target>
        <Button
          onClick={() => combobox.toggleDropdown()}
          leftSection={<ICONS.Add size="1rem" />}
          loading={isPending}
        >
          添加用户组
        </Button>
      </Combobox.Target>

      <Combobox.Dropdown>
        <Combobox.Search
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          leftSection={<ICONS.Search size="1rem" style={{ marginRight: 6 }} />}
          placeholder="搜索…"
        />
        <Combobox.Options mah={224} style={{ overflowY: "auto" }}>
          {filtered.map((group) => (
            <Combobox.Option key={group._id?.$oid!} value={group._id?.$oid!}>
              <Group gap="xs">
                <ICONS.UserGroup size="1rem" />
                <Text>{group.name}</Text>
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
