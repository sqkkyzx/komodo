import { useInvalidate, useWrite } from "@/lib/hooks";
import { ICONS } from "@/lib/icons";
import { ConfirmButton } from "mogh_ui";
import { notifications } from "@mantine/notifications";

export default function DeleteTag({
  tagId,
  disabled,
}: {
  tagId: string;
  disabled: boolean;
}) {
  const invalidate = useInvalidate();
  const { mutate, isPending } = useWrite("DeleteTag", {
    onSuccess: () => {
      invalidate(["ListTags"]);
      notifications.show({ message: "标签已删除" });
    },
  });
  return (
    <ConfirmButton
      icon={<ICONS.Delete size="1rem" />}
      onClick={(e) => {
        e.stopPropagation();
        mutate({ id: tagId });
      }}
      loading={isPending}
      disabled={disabled}
      confirmProps={{ variant: "filled", color: "red" }}
    >
      删除
    </ConfirmButton>
  );
}
