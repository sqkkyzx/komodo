import { useInvalidate, useWrite } from "@/lib/hooks";
import { CreateModal } from "mogh_ui";
import { TextInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useState } from "react";

export default function NewServiceUser() {
  const inv = useInvalidate();
  const { mutateAsync: create, isPending } = useWrite("CreateServiceUser", {
    onSuccess: () => {
      inv(["ListUsers"]);
      notifications.show({ message: "服务用户已创建", color: "green" });
    },
  });
  const [username, setUsername] = useState("");

  return (
    <CreateModal
      entityType="服务用户"
      onConfirm={() => create({ username, description: "" }).then(() => true)}
      loading={isPending}
      configureLabel="唯一的用户名"
      configSection={() => (
        <>
          <TextInput
            autoFocus
            placeholder="用户名"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            error={!username.trim() && "请输入用户名"}
          />
        </>
      )}
    />
  );
}
