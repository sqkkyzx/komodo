import { languageFromPath, MonacoEditor } from "mogh_ui";
import { useExecute, useInvalidate, usePermissions } from "@/lib/hooks";
import { CreateModal } from "mogh_ui";
import { Stack, Text, TextInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useMemo, useState } from "react";

export default function NewSwarmConfig({ id }: { id: string }) {
  const invalidate = useInvalidate();
  const { canExecute } = usePermissions({ type: "Swarm", id });
  const [name, setName] = useState("");
  const [data, setData] = useState("");
  const { mutateAsync: create, isPending } = useExecute("CreateSwarmConfig", {
    onSuccess: () => {
      invalidate(["ListSwarmConfigs"]);
      notifications.show({ message: "已创建集群配置。" });
      setName("");
      setData("");
    },
  });
  const language = useMemo(() => languageFromPath(name), [name]);
  return (
    <CreateModal
      modalSize="xl"
      entityType="集群配置"
      onConfirm={() => create({ swarm: id, name, data }).then(() => true)}
      disabled={!canExecute}
      loading={isPending}
      configureLabel="唯一的名称和内容"
      configSection={() => (
        <Stack>
          <TextInput
            label="名称"
            autoFocus
            placeholder="config.yaml"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={!name.trim() && "输入名称"}
            maw={{ base: "100%", sm: 300 }}
          />
          <Stack gap="0.1rem">
            <Text size="sm">内容</Text>
            <MonacoEditor
              value={data}
              onValueChange={setData}
              language={language}
              maxHeightProportion={0.4}
            />
          </Stack>
        </Stack>
      )}
    />
  );
}
