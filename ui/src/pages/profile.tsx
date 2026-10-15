import { useUser, useUserInvalidate } from "@/lib/hooks";
import {
  ActionIcon,
  Group,
  PasswordInput,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { Save } from "lucide-react";
import { useEffect, useState } from "react";
import {
  EnableSwitch,
  useLoginOptions,
  useManageAuth,
  Section,
  LinkedLogins,
  PageGuard,
  EntityPage,
  EnrollPasskey,
  EnrollTotp,
} from "mogh_ui";
import ApiKeysSection from "@/components/api-keys/section";
import UserHeader from "@/components/user/header";
import { ICONS } from "@/lib/icons";
import { Types } from "komodo_client";

export default function Profile() {
  const options = useLoginOptions().data;
  const userInvalidate = useUserInvalidate();
  const { data: user, refetch: refetchUser, isPending } = useUser();
  const [username, setUsername] = useState(user?.username);
  useEffect(() => {
    setUsername(user?.username);
  }, [user?.username]);
  const [password, setPassword] = useState("");
  const { mutate: updateUsername } = useManageAuth("UpdateUsername", {
    onSuccess: () => {
      notifications.show({ message: "用户名已更新。", color: "green" });
      refetchUser();
    },
  });
  const { mutate: updatePassword } = useManageAuth("UpdatePassword", {
    onSuccess: () => {
      notifications.show({ message: "密码已更新。", color: "green" });
      setPassword("");
      refetchUser();
    },
  });
  const { mutate: updateExternalSkip2fa } = useManageAuth(
    "UpdateExternalSkip2fa",
    {
      onSuccess: () => {
        notifications.show({
          message: "外部登录跳过双重验证设置已更新。",
          color: "green",
        });
        refetchUser();
      },
    },
  );

  return (
    <PageGuard isPending={isPending} error={!user ? "未找到用户" : undefined}>
      {user && (
        <EntityPage>
          <UserHeader user={user} />
          <Section
            title="登录"
            titleFz="h3"
            icon={<ICONS.Key size="1.2rem" />}
            withBorder
          >
            <Stack gap="0">
              <Group>
                <Text ff="monospace">用户名：</Text>

                <TextInput
                  placeholder="更新用户名"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  w={250}
                />

                <ActionIcon
                  onClick={() => username && updateUsername({ username })}
                  disabled={!username || username === user.username}
                >
                  <Save size="1rem" />
                </ActionIcon>
              </Group>

              {options?.local && (
                <Group mt="sm">
                  <Text ff="monospace">密码：</Text>

                  <PasswordInput
                    placeholder="更新密码"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    w={250}
                  />

                  <ActionIcon
                    onClick={() => updatePassword({ password })}
                    disabled={!password}
                  >
                    <Save size="1rem" />
                  </ActionIcon>
                </Group>
              )}
            </Stack>
          </Section>

          <LinkedLogins
            refetchUser={refetchUser}
            passwordSet={
              !!(
                user.linked_logins?.Local as Extract<
                  Types.UserConfig,
                  { type: "Local" }
                >
              )?.data?.password
            }
            oidcLinkedId={
              (
                user.linked_logins?.Oidc as Extract<
                  Types.UserConfig,
                  { type: "Oidc" }
                >
              )?.data?.user_id
            }
            githubLinkedId={
              (
                user.linked_logins?.Github as Extract<
                  Types.UserConfig,
                  { type: "Github" }
                >
              )?.data?.github_id
            }
            googleLinkedId={
              (
                user.linked_logins?.Google as Extract<
                  Types.UserConfig,
                  { type: "Google" }
                >
              )?.data?.google_id
            }
            extraProviderFilter={(provider) => user.config.type !== provider}
          />

          <Section
            title="2FA"
            titleFz="h3"
            icon={<ICONS.Key size="1.2rem" />}
            withBorder
          >
            <Group>
              <EnrollPasskey
                userInvalidate={userInvalidate}
                passkeyEnrolled={!!user.passkey?.created_at}
                totpEnrolled={!!user.totp?.confirmed_at}
              />
              <EnrollTotp
                userInvalidate={userInvalidate}
                passkeyEnrolled={!!user.passkey?.created_at}
                totpEnrolled={!!user.totp?.confirmed_at}
              />
              {(!!user.totp?.confirmed_at || !!user.passkey?.created_at) && (
                <EnableSwitch
                  label="外部登录时跳过双重验证"
                  checked={user.external_skip_2fa}
                  onCheckedChange={(external_skip_2fa) =>
                    updateExternalSkip2fa({ external_skip_2fa })
                  }
                  redDisabled={false}
                />
              )}
            </Group>
          </Section>

          <ApiKeysSection />
        </EntityPage>
      )}
    </PageGuard>
  );
}
