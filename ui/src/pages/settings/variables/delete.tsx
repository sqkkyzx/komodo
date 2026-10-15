import { useInvalidate, useWrite } from "@/lib/hooks";
import { ICONS } from "@/lib/icons";
import { ConfirmButton } from "mogh_ui";
import { notifications } from "@mantine/notifications";

export default function DeleteVariable({
  name,
  disabled,
}: {
  name: string;
  disabled: boolean;
}) {
  const invalidate = useInvalidate();
  const { mutate, isPending } = useWrite("DeleteVariable", {
    onSuccess: () => {
      invalidate(["ListVariables"]);
      notifications.show({ message: "变量已删除" });
    },
  });
  return (
    <ConfirmButton
      icon={<ICONS.Delete size="1rem" />}
      onClick={(e) => {
        e.stopPropagation();
        mutate({ name });
      }}
      loading={isPending}
      disabled={disabled}
      confirmProps={{ variant: "filled", color: "red" }}
    >
      删除
    </ConfirmButton>
  );
}
