import { useInvalidate, useWrite } from "@/lib/hooks";
import { CreateModal } from "mogh_ui";
import { TextInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useState } from "react";

export default function NewTag() {
  const invalidate = useInvalidate();
  const [name, setName] = useState("");
  const { mutateAsync: create, isPending } = useWrite("CreateTag", {
    onSuccess: () => {
      invalidate(["ListTags"], ["GetTag"]);
      notifications.show({ message: "标签已创建" });
      setName("");
    },
  });
  return (
    <CreateModal
      entityType="标签"
      onConfirm={() => create({ name }).then(() => true)}
      disabled={false}
      loading={isPending}
      openShiftKeyListener="N"
      configSection={() => (
        <>
          <TextInput
            autoFocus
            placeholder="标签名称"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={!name.trim() && "请输入名称"}
          />
        </>
      )}
    />
  );
}
