import { useInvalidate, useWrite } from "@/lib/hooks";
import { CreateModal } from "mogh_ui";
import { PasswordInput, TextInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useState } from "react";

export default function NewLocalUser() {
  const inv = useInvalidate();
  const { mutateAsync: create, isPending } = useWrite("CreateLocalUser", {
    onSuccess: () => {
      inv(["ListUsers"]);
      notifications.show({ message: "本地用户已创建", color: "green" });
    },
  });
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  return (
    <CreateModal
      entityType="本地用户"
      onConfirm={() => create({ username, password }).then(() => true)}
      loading={isPending}
      configureLabel="登录信息"
      configSection={() => (
        <>
          <TextInput
            autoFocus
            label="用户名"
            placeholder="用户名"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            error={!username.trim() && "请输入用户名"}
          />
          <PasswordInput
            label="密码"
            placeholder="密码"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={!password.trim() && "请输入密码"}
          />
          <PasswordInput
            label="确认密码"
            placeholder="确认密码"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            error={
              password !== confirmPassword ? "两次输入的密码不一致" : undefined
            }
          />
        </>
      )}
    />
  );
}
