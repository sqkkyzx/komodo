import { useInvalidate, useWrite } from "@/lib/hooks";
import { ICONS } from "@/lib/icons";
import { CopyText } from "mogh_ui";
import {
  Button,
  Group,
  Modal,
  PasswordInput,
  Select,
  Stack,
  Text,
  TextInput,
  useMatches,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { useState } from "react";

type ExpiresOptions = "1 day" | "7 days" | "30 days" | "Never";
const ONE_DAY_MS = 1000 * 60 * 60 * 24;

export default function NewOnboardingKey() {
  const [opened, { open, close: _close }] = useDisclosure();
  const [name, setName] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [expires, setExpires] = useState<ExpiresOptions>("1 day");

  const [created, setCreated] = useState<{ private_key: string }>();
  const invalidate = useInvalidate();
  const { mutate, isPending } = useWrite("CreateOnboardingKey", {
    onSuccess: ({ private_key }) => {
      notifications.show({ message: "注册密钥已创建" });
      invalidate(["ListOnboardingKeys"]);
      setCreated({ private_key });
    },
  });
  const now = Date.now();
  const expiresOptions: Record<ExpiresOptions, number> = {
    "1 day": now + ONE_DAY_MS,
    "7 days": now + ONE_DAY_MS * 7,
    "30 days": now + ONE_DAY_MS * 90,
    Never: 0,
  };
  const create = () =>
    mutate({
      name,
      expires: expiresOptions[expires],
      private_key: privateKey || undefined,
    });

  const close = () => {
    setName("");
    setPrivateKey("");
    setExpires("1 day");
    setCreated(undefined);
    _close();
  };

  const size = useMatches({ base: "90%", md: 500 });

  return (
    <>
      <Modal
        opened={opened}
        onClose={close}
        title={
          <Text size="lg">
            {!created && "创建注册密钥"}
            {created && "注册密钥已创建"}
          </Text>
        }
        size={size}
      >
        <Stack>
          {!created && (
            <>
              <Group justify="space-between">
                <Text>名称</Text>
                <TextInput
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="可选"
                  w={{ base: 200, lg: 300 }}
                />
              </Group>

              <Group justify="space-between">
                <Text>现有密钥</Text>
                <PasswordInput
                  value={privateKey}
                  onChange={(e) => setPrivateKey(e.target.value)}
                  placeholder="可选"
                  w={{ base: 200, lg: 300 }}
                />
              </Group>

              <Group justify="space-between">
                <Text>有效期</Text>
                <Select
                  value={expires}
                  onChange={(expires) => expires && setExpires(expires as any)}
                  data={Object.keys(expiresOptions).map((value) => ({
                    value,
                    label: {
                      "1 day": "1 天",
                      "7 days": "7 天",
                      "30 days": "30 天",
                      Never: "永不过期",
                    }[value as ExpiresOptions],
                  }))}
                  w={{ base: 200, lg: 300 }}
                />
              </Group>

              <Group justify="end">
                <Button
                  variant="secondary"
                  className="gap-4"
                  onClick={create}
                  leftSection={<ICONS.Check size="1rem" />}
                  loading={isPending}
                >
                  创建
                </Button>
              </Group>
            </>
          )}

          {created && (
            <>
              <Text size="md" my="sm">
                请复制下方的注册密钥。 <b>此密钥仅显示一次</b>。
              </Text>

              <CopyText content={created.private_key} label="私钥" w="90%" />

              <Group justify="end" onClick={close}>
                <Button leftSection={<ICONS.Clear />}>关闭</Button>
              </Group>
            </>
          )}
        </Stack>
      </Modal>

      <Button leftSection={<ICONS.Create size="1rem" />} onClick={open}>
        新建注册密钥
      </Button>
    </>
  );
}
