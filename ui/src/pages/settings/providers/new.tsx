import { useInvalidate, useWrite } from "@/lib/hooks";
import { ICONS } from "@/lib/icons";
import {
  Button,
  Group,
  Modal,
  Stack,
  Switch,
  Text,
  TextInput,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { CircleCheckBig } from "lucide-react";
import { ChangeEvent, useState } from "react";

export default function NewProviderAccount({
  type,
}: {
  type: "GitProvider" | "ImageRegistry";
}) {
  const [opened, { open, close }] = useDisclosure();
  const [domain, setDomain] = useState("");
  const [https, setHttps] = useState(true);
  const [username, setUsername] = useState("");
  const [token, setToken] = useState("");
  const invalidate = useInvalidate();
  const { mutate: create, isPending } = useWrite(`Create${type}Account`, {
    onSuccess: () => {
      invalidate([`List${type}Accounts`]);
      notifications.show({ message: "账户已创建" });
      close();
    },
  });
  const submit = () => create({ account: { domain, https, username, token } });

  const form: Array<
    | undefined
    | [string, string, (e: ChangeEvent<HTMLInputElement>) => void, false]
    | [string, boolean, (checked: boolean) => void, true]
  > = [
    [
      "域名",
      domain,
      (e: ChangeEvent<HTMLInputElement>) => setDomain(e.target.value),
      false,
    ],
    type === "GitProvider"
      ? ["使用 HTTPS", https, (https: boolean) => setHttps(https), true]
      : undefined,
    [
      "用户名",
      username,
      (e: ChangeEvent<HTMLInputElement>) => setUsername(e.target.value),
      false,
    ],
    [
      "令牌",
      token,
      (e: ChangeEvent<HTMLInputElement>) => setToken(e.target.value),
      false,
    ],
  ];
  const accountType = type === "ImageRegistry" ? "镜像仓库账户" : "Git 账户";

  return (
    <>
      <Modal
        opened={opened}
        onClose={close}
        title={<Text size="lg">创建 {accountType}</Text>}
        size="lg"
      >
        <Stack>
          {form.map((item) => {
            if (!item) return;

            const [title, value, onChange, bool] = item;

            if (bool) {
              return (
                <Group key={title} justify="space-between">
                  {title}
                  <Switch
                    checked={value}
                    onChange={(e) => onChange(e.target.checked)}
                  />
                </Group>
              );
            }

            return (
              <Group key={title} justify="space-between">
                {title}
                <TextInput
                  placeholder={`输入${title.toLowerCase()}`}
                  value={value}
                  onChange={onChange}
                  w={{ base: 200, lg: 300 }}
                />
              </Group>
            );
          })}

          <Group justify="end">
            <Button
              leftSection={<CircleCheckBig size="1rem" />}
              onClick={submit}
              loading={isPending}
            >
              创建
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Button leftSection={<ICONS.Create size="1rem" />} onClick={open}>
        新建账户
      </Button>
    </>
  );
}
