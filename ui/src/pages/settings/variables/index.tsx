import NewVariable from "@/pages/settings/variables/new";
import {
  useInvalidate,
  useRead,
  useSetTitle,
  useUser,
  useWrite,
} from "@/lib/hooks";
import { filterBySplit } from "mogh_ui";
import { CopyButton } from "mogh_ui";
import { DataTable, SortableHeader } from "mogh_ui";
import { Badge, Button, Group, Stack, Switch, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useState } from "react";
import DeleteVariable from "./delete";
import { SharedTextUpdate, useSharedTextUpdateData } from "mogh_ui";
import { CopyText } from "mogh_ui";
import { SearchInput } from "mogh_ui";

export default function SettingsVariables() {
  const user = useUser().data;
  const disabled = !user?.admin;
  useSetTitle("Variables");
  const [updateMenuData, setUpdateMenuData] = useSharedTextUpdateData();

  const [search, setSearch] = useState("");

  const variables = useRead("ListVariables", {}).data ?? [];
  const secrets = useRead("ListSecrets", {}).data ?? [];

  const filtered = filterBySplit(variables, search, (item) => item.name);

  const inv = useInvalidate();

  const { mutate: updateValue } = useWrite("UpdateVariableValue", {
    onSuccess: () => {
      inv(["ListVariables"], ["GetVariable"]);
      notifications.show({ message: "变量值已更新" });
    },
  });

  const { mutate: updateDescription } = useWrite("UpdateVariableDescription", {
    onSuccess: () => {
      inv(["ListVariables"], ["GetVariable"]);
      notifications.show({ message: "变量描述已更新" });
    },
  });

  const { mutate: updateIsSecret } = useWrite("UpdateVariableIsSecret", {
    onSuccess: () => {
      inv(["ListVariables"], ["GetVariable"]);
      notifications.show({ message: "变量保密设置已更新" });
    },
  });

  return (
    <>
      <Stack>
        <Group justify="space-between">
          <NewVariable />
          <SearchInput value={search} onSearch={setSearch} />
        </Group>

        <DataTable
          tableKey="variables"
          data={filtered}
          columns={[
            {
              accessorKey: "name",
              header: ({ column }) => (
                <SortableHeader column={column} title="名称" />
              ),
              cell: ({ row }) => {
                return (
                  <CopyText content={row.original.name} label="变量名称" />
                );
              },
            },
            {
              accessorKey: "value",
              header: ({ column }) => (
                <SortableHeader column={column} title="值" />
              ),
              cell: ({ row }) => {
                return (
                  <Group gap="sm" wrap="nowrap">
                    <Button
                      className="text-ellipsis"
                      onClick={() => {
                        setUpdateMenuData({
                          title: `${row.original.name} - 值`,
                          value: row.original.value ?? "",
                          placeholder: "设置值",
                          onUpdate: (value) => {
                            if (row.original.value === value) {
                              return;
                            }
                            updateValue({ name: row.original.name, value });
                          },
                        });
                      }}
                      w={{ base: 200, lg: 300 }}
                      justify="start"
                    >
                      {(row.original.is_secret
                        ? "*".repeat(row.original.value?.length ?? 0)
                        : row.original.value) || <Text c="dimmed">设置值</Text>}
                    </Button>
                    <CopyButton content={row.original.value ?? ""} />
                  </Group>
                );
              },
            },
            {
              accessorKey: "description",
              header: ({ column }) => (
                <SortableHeader column={column} title="描述" />
              ),
              cell: ({ row }) => {
                return (
                  <Button
                    className="text-ellipsis"
                    onClick={() => {
                      setUpdateMenuData({
                        title: `${row.original.name} - 描述`,
                        value: row.original.description ?? "",
                        placeholder: "设置描述",
                        onUpdate: (description) => {
                          if (row.original.description === description) {
                            return;
                          }
                          updateDescription({
                            name: row.original.name,
                            description,
                          });
                        },
                      });
                    }}
                    w={{ base: 200, lg: 300 }}
                    justify="start"
                  >
                    {row.original.description || (
                      <Text c="dimmed">设置描述</Text>
                    )}
                  </Button>
                );
              },
            },
            {
              header: "保密",
              cell: ({ row }) => (
                <Switch
                  checked={row.original.is_secret}
                  onChange={(e) =>
                    updateIsSecret({
                      name: row.original.name,
                      is_secret: e.target.checked,
                    })
                  }
                  disabled={disabled}
                />
              ),
            },
            {
              header: "删除",
              cell: ({ row }) => (
                <DeleteVariable name={row.original.name} disabled={disabled} />
              ),
            },
          ]}
        />

        {secrets?.length ? (
          <Group>
            <Text c="dimmed">Core 机密：</Text>
            <Group gap="xs">
              {secrets.map((secret) => (
                <Badge key={secret} tt="none">
                  {secret}
                </Badge>
              ))}
            </Group>
          </Group>
        ) : undefined}
      </Stack>

      <SharedTextUpdate
        data={updateMenuData}
        setData={setUpdateMenuData}
        disabled={disabled}
      />
    </>
  );
}
