import { useRead } from "@/lib/hooks";
import { ConfigItem } from "mogh_ui";
import { Select, SelectProps } from "@mantine/core";

export interface AccountSelectorProps extends Omit<SelectProps, "onSelect"> {
  disabled: boolean;
  type: "Server" | "Builder" | "None";
  id?: string;
  accountType: "git" | "docker";
  provider: string;
  selected: string | undefined;
  onSelect: (id: string) => void;
  placeholder?: string;
  showLabel?: boolean;
}

export default function AccountSelector({
  disabled,
  type,
  id,
  accountType,
  provider,
  selected,
  onSelect,
  placeholder,
  showLabel,
  ...selectProps
}: AccountSelectorProps) {
  const [dbRequest, configRequest]:
    | ["ListGitProviderAccounts", "ListGitProvidersFromConfig"]
    | ["ListImageRegistryAccounts", "ListImageRegistriesFromConfig"] =
    accountType === "git"
      ? ["ListGitProviderAccounts", "ListGitProvidersFromConfig"]
      : ["ListImageRegistryAccounts", "ListImageRegistriesFromConfig"];
  const dbAccounts = useRead(dbRequest, {}).data?.filter(
    (account) => account.domain === provider,
  );
  const configParams =
    type === "None" ? {} : { target: id ? { type, id } : undefined };
  const configProviders = useRead(configRequest, configParams).data?.filter(
    (_provider) => _provider.domain === provider,
  );

  const _accounts = new Set<string>();
  for (const account of dbAccounts ?? []) {
    if (account.username) {
      _accounts.add(account.username);
    }
  }
  for (const provider of configProviders ?? []) {
    for (const account of provider.accounts ?? []) {
      _accounts.add(account.username);
    }
  }
  const accounts = [..._accounts];
  accounts.sort();
  accounts.unshift("None");

  return (
    <Select
      label={showLabel && "账号"}
      value={selected || "None"}
      onChange={(value) => value && onSelect(value === "None" ? "" : value)}
      disabled={disabled}
      data={accounts.map((value) => ({
        value,
        label: value === "None" ? "无" : value,
      }))}
      w="fit-content"
      placeholder="选择账号"
      {...selectProps}
    />
  );
}

export function AccountSelectorConfig({
  description,
  ...props
}: { description?: string } & AccountSelectorProps) {
  return (
    <ConfigItem
      label="账号"
      description={description ?? "选择用于登录服务商的账号"}
    >
      <AccountSelector {...props} />
    </ConfigItem>
  );
}
