import { useTags, useWrite } from "@/lib/hooks";
import { ICONS } from "@/lib/icons";
import { ConfirmButton } from "mogh_ui";
import { notifications } from "@mantine/notifications";

export default function BatchDeleteAllTerminals({
  refetch,
  noTerminals,
}: {
  refetch: () => void;
  noTerminals: boolean;
}) {
  const { mutate, isPending } = useWrite("BatchDeleteAllTerminals", {
    onSuccess: () => {
      refetch();
      notifications.show({ message: "所有终端已删除" });
    },
  });
  const { tags } = useTags();
  return (
    <ConfirmButton
      icon={<ICONS.Delete size="1rem" />}
      w={160}
      onClick={() => mutate({ query: { tags } })}
      disabled={noTerminals}
      loading={isPending}
      confirmProps={{ variant: "filled", color: "red" }}
    >
      全部删除
    </ConfirmButton>
  );
}
