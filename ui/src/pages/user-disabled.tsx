import { useUser } from "@/lib/hooks";
import { Button, Center, Paper, Stack, Text } from "@mantine/core";
import { LogOut, UserX } from "lucide-react";
import { MoghAuth } from "komodo_client";

export default function UserDisabled() {
  const user_id = useUser().data?._id?.$oid;
  return (
    <Center h="70vh">
      <Paper bdrs="md" p="xl">
        <Stack justify="center" align="center">
          <UserX size="2rem" />
          <Text fz="h2">用户尚未启用</Text>
          <Button
            variant="filled"
            color="red"
            leftSection={<LogOut size="1rem" />}
            onClick={() => {
              user_id && MoghAuth.LOGIN_TOKENS.remove(user_id);
              location.reload();
            }}
          >
            退出登录
          </Button>
        </Stack>
      </Paper>
    </Center>
  );
}
