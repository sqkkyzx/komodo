import { useInvalidate, useUser, useWrite } from "@/lib/hooks";
import { CreateModal } from "mogh_ui";
import { TextInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useState } from "react";

export default function NewVariable() {
  const invalidate = useInvalidate();
  const [name, setName] = useState("");
  const { mutateAsync: create, isPending } = useWrite("CreateVariable", {
    onSuccess: () => {
      invalidate(["ListVariables"], ["GetVariable"]);
      notifications.show({ message: "变量已创建" });
      setName("");
    },
  });
  const user = useUser().data;
  const disabled = !user?.admin;
  return (
    <CreateModal
      entityType="变量"
      onConfirm={() => create({ name }).then(() => true)}
      disabled={disabled}
      loading={isPending}
      openShiftKeyListener="N"
      configSection={() => (
        <>
          <TextInput
            autoFocus
            placeholder="变量名称"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={!name.trim() && "请输入名称"}
          />
        </>
      )}
    />
  );
}
