import { languageFromPath, MonacoEditor } from "mogh_ui";
import { useExecute, usePermissions, useRead } from "@/lib/hooks";
import { ICONS } from "@/lib/icons";
import { ConfirmUpdate } from "mogh_ui";
import { UnsavedChanges } from "mogh_ui";
import { Section, SectionProps } from "mogh_ui";
import { Button, Group } from "@mantine/core";
import { useLocalStorage } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";

export interface SwarmConfigEditProps extends SectionProps {
  swarm: string;
  config: string;
}

export default function SwarmConfigEditSection({
  swarm,
  config,
  ...sectionProps
}: SwarmConfigEditProps) {
  const [{ edit }, setEdit] = useLocalStorage<{ edit: string | undefined }>({
    key: `swarm-${swarm}-config-${config}-edit-v2`,
    defaultValue: { edit: undefined },
  });
  const {
    data: inspect,
    isPending,
    refetch,
    isError,
  } = useRead("InspectSwarmConfig", {
    swarm,
    config,
  });
  const { canExecute } = usePermissions({
    type: "Swarm",
    id: swarm,
  });
  const { mutateAsync: confirmEdit } = useExecute("RotateSwarmConfig", {
    onSuccess: (res) => {
      notifications.show({
        message: res.success ? "配置已更新。" : "更新配置失败。",
        color: res.success ? "green" : "red",
      });
      setEdit({ edit: undefined });
      refetch();
    },
  });

  const name = inspect?.Spec?.Name;
  const data = inspect?.Spec?.Data;
  const language = name ? languageFromPath(name) : undefined;

  return (
    <Section
      isPending={isPending}
      error={
        isError
          ? "无法检查集群配置。"
          : !config
            ? `未找到以下名称的集群配置：${config}`
            : undefined
      }
      actions={
        canExecute && (
          <Group>
            {edit !== undefined && <UnsavedChanges />}{" "}
            <Button
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                setEdit({ edit: undefined });
              }}
              disabled={edit === undefined}
              leftSection={<ICONS.History size="1rem" />}
              w={100}
            >
              重置
            </Button>
            <ConfirmUpdate
              original={{ contents: data }}
              update={{ contents: edit }}
              onConfirm={async () =>
                name &&
                edit !== undefined &&
                (await confirmEdit({ swarm, config: name, data: edit }))
              }
              disabled={edit === undefined}
              language={language}
              loading={isPending}
            />
          </Group>
        )
      }
      {...sectionProps}
    >
      <MonacoEditor
        value={edit ?? data ?? "无法获取配置数据"}
        language={language}
        onValueChange={(edit) => setEdit({ edit })}
        readOnly={!canExecute}
      />
    </Section>
  );
}
