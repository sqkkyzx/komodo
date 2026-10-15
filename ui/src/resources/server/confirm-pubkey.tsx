import { Group, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { CircleOff } from "lucide-react";
import { usePermissions, useWrite } from "@/lib/hooks";
import { ConfirmModal } from "mogh_ui";
import { useServer } from ".";

export default function ConfirmServerPubkey({ id }: { id: string }) {
  const server = useServer(id);
  const { canWrite } = usePermissions({ type: "Server", id });
  const { mutateAsync: confirm, isPending } = useWrite(
    "UpdateServerPublicKey",
    {
      onSuccess: () => {
        notifications.show({
          message: "已确认服务器公钥",
          color: "green",
        });
      },
    },
  );

  if (!server?.info.attempted_public_key) return null;

  return (
    <ConfirmModal
      disabled={!canWrite}
      title="确认公钥"
      confirmButtonContent="确认"
      confirmText={server.name}
      icon={<CircleOff size="1rem" />}
      targetProps={{ color: "red" }}
      topAdditonal={
        <Group gap="xs">
          <Text c="dimmed">公钥：</Text>
          {server.info.attempted_public_key}
        </Group>
      }
      additional={
        <Text>提示：状态更新可能需要稍等片刻。</Text>
      }
      onConfirm={() =>
        confirm({ server: id, public_key: server.info.attempted_public_key! })
      }
      loading={isPending}
    >
      无效公钥
    </ConfirmModal>
  );
}
