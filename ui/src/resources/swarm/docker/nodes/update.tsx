import { displayLabel } from "@/lib/l10n";
import { useExecute, useRead } from "@/lib/hooks";
import {
  Button,
  Group,
  Loader,
  Modal,
  Select,
  SimpleGrid,
  Stack,
  TagsInput,
  Text,
  useMatches,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useMemo, useState } from "react";
import { Types } from "komodo_client";
import { ICONS } from "@/lib/icons";
import { LabelsGroup } from "mogh_ui";

export interface UpdateSwarmNodeProps {
  swarm: string;
  nodes: string[];
}

export default function UpdateSwarmNodes({
  swarm,
  nodes,
}: UpdateSwarmNodeProps) {
  const [opened, { open, close }] = useDisclosure();
  const { data: inspect, isPending } = useRead(
    "InspectSwarmNode",
    { swarm, node: nodes[0] },
    { enabled: opened && nodes.length === 1 },
  );

  const currentLabels = useMemo(() => {
    const labels = inspect?.Spec?.Labels ?? {};
    return Object.entries(labels).sort();
  }, [inspect]);

  const currentRole = inspect?.Spec?.Role ?? "";
  const currentAvailability = inspect?.Spec?.Availability ?? "";

  const [role, setRole] = useState<string | null>(null);
  const [availability, setAvailability] = useState<string | null>(null);
  const [labelsToAdd, setLabelsToAdd] = useState<string[]>([]);
  const [labelsToRemove, setLabelsToRemove] = useState<string[]>([]);

  const { mutate: update, isPending: updatePending } = useExecute(
    "UpdateSwarmNode",
    {
      onSuccess: () => {
        close();
        resetForm();
      },
    },
  );

  const resetForm = () => {
    setRole(null);
    setAvailability(null);
    setLabelsToAdd([]);
    setLabelsToRemove([]);
  };

  const onSubmit = () => {
    for (const node of nodes) {
      update({
        swarm,
        node,
        role: role ? (role as Types.NodeSpecRoleEnum) : undefined,
        availability: availability
          ? (availability as Types.NodeSpecAvailabilityEnum)
          : undefined,
        label_add: labelsToAdd.length > 0 ? labelsToAdd : undefined,
        label_rm: labelsToRemove.length > 0 ? labelsToRemove : undefined,
      });
    }
  };

  const tagSpan = useMatches({ base: 1, sm: 2 });

  return (
    <>
      <Modal
        opened={opened}
        onClose={() => {
          close();
          resetForm();
        }}
        title={`更新节点：${nodes.join(", ")}`}
        size="xl"
      >
        {nodes.length === 1 && isPending ? (
          <Group justify="center" p="xl">
            <Loader />
          </Group>
        ) : (
          <Stack>
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <Select
                label="角色"
                placeholder={
                  (nodes.length === 1 &&
                    currentRole &&
                    `当前：${displayLabel(currentRole)}`) ||
                  "选择角色"
                }
                data={[
                  { value: "worker", label: "工作节点" },
                  { value: "manager", label: "管理节点" },
                ]}
                value={role}
                onChange={setRole}
                clearable
              />

              <Select
                label="可用状态"
                placeholder={
                  (nodes.length === 1 &&
                    currentAvailability &&
                    `当前：${displayLabel(currentAvailability)}`) ||
                  "选择可用状态"
                }
                data={[
                  { value: "active", label: "活跃" },
                  { value: "pause", label: "暂停" },
                  { value: "drain", label: "排空" },
                ]}
                value={availability}
                onChange={setAvailability}
                clearable
              />

              <TagsInput
                label="要添加的标签。按回车可添加多个。"
                placeholder="key=value"
                value={labelsToAdd}
                onChange={setLabelsToAdd}
              />

              <TagsInput
                label="要移除的标签"
                placeholder="key"
                data={currentLabels.map(([key, _]) => key)}
                value={labelsToRemove}
                onChange={setLabelsToRemove}
              />

              {currentLabels.length > 0 && (
                <Stack gap="0.25rem" style={{ gridColumn: `span ${tagSpan}` }}>
                  <Text size="sm" fw={500}>
                    当前标签
                  </Text>
                  <LabelsGroup labels={currentLabels} />
                </Stack>
              )}
            </SimpleGrid>
            <Group justify="flex-end" mt="md">
              <Button
                variant="default"
                onClick={() => {
                  close();
                  resetForm();
                }}
              >
                取消
              </Button>
              <Button onClick={onSubmit} loading={updatePending}>
                更新
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>

      <Button
        onClick={open}
        disabled={!nodes.length}
        rightSection={<ICONS.Edit size="1rem" />}
        justify="space-between"
        w={{ base: "100%", xs: 190 }}
      >
        更新节点
      </Button>
    </>
  );
}
