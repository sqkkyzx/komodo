import {
  useInvalidate,
  useRead,
  useSetTitle,
  useUser,
  useWrite,
} from "@/lib/hooks";
import { ICONS } from "@/lib/icons";
import { Section } from "mogh_ui";
import { Button, Group, Stack, Switch, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useState } from "react";
import NewProviderAccount from "./new";
import { DataTable, SortableHeader } from "mogh_ui";
import DeleteProviderAccount from "./delete";
import ProvidersFromConfig from "./from-config";
import { CopyButton } from "mogh_ui";
import { Types } from "komodo_client";
import { SharedTextUpdate, useSharedTextUpdateData } from "mogh_ui";
import { SearchInput } from "mogh_ui";

export default function SettingsProviders() {
  return (
    <Stack gap="xl">
      <Providers type="GitProvider" />
      <Providers type="ImageRegistry" />
    </Stack>
  );
}

function Providers({ type }: { type: "GitProvider" | "ImageRegistry" }) {
  const user = useUser().data;
  const disabled = !user?.admin;
  useSetTitle("Providers");

  const [updateMenuData, setUpdateMenuData] = useSharedTextUpdateData();

  const [search, setSearch] = useState("");

  const accounts = useRead(`List${type}Accounts`, {}).data ?? [];
  const searchSplit = search?.toLowerCase().split(" ") || [];
  const filtered =
    accounts?.filter((account) => {
      if (searchSplit.length > 0) {
        const domain = account.domain?.toLowerCase();
        const username = account.username?.toLowerCase();
        return searchSplit.every(
          (search) =>
            domain.includes(search) || (username && username.includes(search)),
        );
      } else return true;
    }) ?? [];

  const inv = useInvalidate();
  const { mutate: updateAccount } = useWrite(`Update${type}Account`, {
    onSuccess: () => {
      inv([`List${type}Accounts`], [`Get${type}Account`]);
      notifications.show({ message: "账户已更新" });
    },
  });

  return (
    <>
      <Section
        title={type === "ImageRegistry" ? "镜像仓库账户" : "Git 账户"}
        icon={
          type === "ImageRegistry" ? (
            <ICONS.Image size="1.3rem" />
          ) : (
            <ICONS.Repo size="1.3rem" />
          )
        }
      >
        <Group justify="space-between">
          <NewProviderAccount type={type} />
          <SearchInput value={search} onSearch={setSearch} />
        </Group>

        {/* ACCOUNTS */}
        <DataTable
          tableKey={type + "-accounts"}
          data={filtered}
          columns={[
            {
              accessorKey: "domain",
              header: ({ column }) => (
                <SortableHeader column={column} title="域名" />
              ),
              cell: ({ row }) => {
                return (
                  <Group gap="sm" wrap="nowrap">
                    <Button
                      className="overflow-ellipsis"
                      onClick={() => {
                        setUpdateMenuData({
                          title: "设置域名",
                          value: row.original.domain ?? "",
                          placeholder: "输入域名，例如 git.komo.do",
                          titleRight:
                            type === "GitProvider" ? (
                              <Group gap="xs">
                                <Text c="dimmed">使用 HTTPS：</Text>
                                <Switch
                                  title="使用 HTTPS"
                                  checked={
                                    (row.original as Types.GitProviderAccount)
                                      .https
                                  }
                                  onChange={(e) =>
                                    updateAccount({
                                      id: row.original._id?.$oid!,
                                      account: { https: e.target.checked },
                                    })
                                  }
                                />
                              </Group>
                            ) : undefined,
                          onUpdate: (domain) => {
                            if (row.original.domain === domain) {
                              return;
                            }
                            updateAccount({
                              id: row.original._id?.$oid!,
                              account: { domain },
                            });
                          },
                        });
                      }}
                      w={{ base: 200, lg: 300 }}
                      justify="start"
                    >
                      {row.original.domain || <Text c="dimmed">设置域名</Text>}
                    </Button>
                    <CopyButton content={row.original.domain ?? ""} />
                  </Group>
                );
              },
            },
            {
              accessorKey: "username",
              header: ({ column }) => (
                <SortableHeader column={column} title="用户名" />
              ),
              cell: ({ row }) => {
                return (
                  <Group gap="sm" wrap="nowrap">
                    <Button
                      className="overflow-ellipsis"
                      onClick={() => {
                        setUpdateMenuData({
                          title: "设置用户名",
                          value: row.original.username ?? "",
                          placeholder: "输入账户用户名",
                          onUpdate: (username) => {
                            if (row.original.username === username) {
                              return;
                            }
                            updateAccount({
                              id: row.original._id?.$oid!,
                              account: { username },
                            });
                          },
                        });
                      }}
                      w={{ base: 200, lg: 300 }}
                      justify="start"
                    >
                      {row.original.username || (
                        <Text c="dimmed">设置用户名</Text>
                      )}
                    </Button>
                    <CopyButton content={row.original.username ?? ""} />
                  </Group>
                );
              },
            },
            {
              accessorKey: "token",
              header: ({ column }) => (
                <SortableHeader column={column} title="令牌" />
              ),
              cell: ({ row }) => {
                return (
                  <Group gap="sm" wrap="nowrap">
                    <Button
                      className="overflow-ellipsis"
                      onClick={(e) => {
                        e.stopPropagation();
                        setUpdateMenuData({
                          title: "设置令牌",
                          value: row.original.token ?? "",
                          placeholder: "输入账户令牌",
                          onUpdate: (token) => {
                            if (row.original.token === token) {
                              return;
                            }
                            updateAccount({
                              id: row.original._id?.$oid!,
                              account: { token },
                            });
                          },
                        });
                      }}
                      w={{ base: 200, lg: 300 }}
                      justify="start"
                    >
                      {"*".repeat(row.original.token?.length || 0) || (
                        <Text c="dimmed">设置令牌</Text>
                      )}
                    </Button>
                    <CopyButton content={row.original.token ?? ""} />
                  </Group>
                );
              },
            },
            {
              header: "删除",
              cell: ({ row }) => (
                <DeleteProviderAccount
                  type={type}
                  id={row.original._id?.$oid!}
                />
              ),
            },
          ]}
        />

        <ProvidersFromConfig type={type} />
      </Section>
      <SharedTextUpdate
        data={updateMenuData}
        setData={setUpdateMenuData}
        disabled={disabled}
      />
    </>
  );
}
