import { useInvalidate, useWrite } from "@/lib/hooks";
import { CreateModal } from "mogh_ui";
import { TextInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useState } from "react";

export default function NewUserGroup() {
  const inv = useInvalidate();
  const { mutateAsync: create, isPending } = useWrite("CreateUserGroup", {
    onSuccess: () => {
      inv(["ListUserGroups"]);
      notifications.show({ message: "用户组已创建", color: "green" });
    },
  });
  const [name, setName] = useState("");
  return (
    <CreateModal
      entityType="用户组"
      onConfirm={() => create({ name }).then(() => true)}
      loading={isPending}
      configSection={() => (
        <>
          <TextInput
            autoFocus
            placeholder="用户组名称"
            value={name}
            onChange={(e) => setName(e.target.value)}
            // onKeyDown={(e) => {
            //   if (!name) {
            //     return;
            //   }
            //   if (e.key === "Enter") {
            //     create({});
            //   }
            // }}
            error={!name.trim() && "请输入名称"}
          />
        </>
      )}
    />
  );
}
