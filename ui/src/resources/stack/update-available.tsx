import {
  useExecute,
  useInvalidate,
  usePermissions,
  useRead,
  useWrite,
} from "@/lib/hooks";
import { notifications } from "@mantine/notifications";
import { useStack } from ".";
import { Types } from "komodo_client";
import {
  ActionIcon,
  Box,
  Button,
  Group,
  HoverCard,
  Stack,
  Text,
} from "@mantine/core";
import { ICONS } from "@/lib/icons";
import ConfirmModalWithDisable from "@/components/confirm-modal-with-disable";
import { hexColorByIntention } from "mogh_ui";

export default function StackUpdateAvailable({
  id,
  small,
}: {
  id: string;
  small?: boolean;
}) {
  const { canExecute } = usePermissions({ type: "Stack", id });
  const { mutateAsync: deploy, isPending } = useExecute("DeployStack");
  const inv = useInvalidate();
  const { mutate: checkForUpdate, isPending: checkPending } = useWrite(
    "CheckStackForUpdate",
    {
      onSuccess: () => {
        notifications.show({ message: "已检查更新", color: "blue" });
        inv(["ListStacks"]);
      },
    },
  );

  const deploying = useRead(
    "GetStackActionState",
    { stack: id },
    { refetchInterval: 5_000, enabled: !small && canExecute },
  ).data?.deploying;
  const pending = isPending || deploying;

  const stack = useStack(id);
  const info = stack?.info;
  const state = info?.state ?? Types.StackState.Unknown;

  if (
    !info ||
    [Types.StackState.Down, Types.StackState.Unknown].includes(state)
  ) {
    return null;
  }

  const servicesWithUpdate =
    info?.services.filter((s) => s.update_available) ?? [];

  const updateAvailable = servicesWithUpdate.length > 0;

  // No quick deploy action / check for update button
  if (small || !canExecute) {
    if (!updateAvailable) {
      return null;
    }
    return (
      <Box>
        <HoverCard>
          <HoverCard.Target>
            {small ? (
              <ActionIcon
                variant="outline"
                bd={"1px solid " + hexColorByIntention("Neutral")}
                size="md"
              >
                <ICONS.UpdateAvailable size="1rem" />
              </ActionIcon>
            ) : (
              <Button
                variant="outline"
                bd={"1px solid " + hexColorByIntention("Neutral")}
                leftSection={<ICONS.UpdateAvailable size="1rem" />}
              >
                有可用更新
              </Button>
            )}
          </HoverCard.Target>
          <HoverCard.Dropdown>
            <Services services={info?.services} />
          </HoverCard.Dropdown>
        </HoverCard>
      </Box>
    );
  }

  return (
    <>
      {updateAvailable && (
        <Box>
          <ConfirmModalWithDisable
            title={
              <>
                确认 <b>重新部署</b>
              </>
            }
            confirmText={stack.name}
            icon={<ICONS.UpdateAvailable size="1rem" />}
            targetProps={{
              variant: "outline",
              bd: "1px solid var(--mantine-color-blue-7)",
            }}
            onConfirm={() =>
              deploy({
                stack: id,
                services: info?.auto_update_all_services
                  ? []
                  : servicesWithUpdate.map((s) => s.service),
              })
            }
            loading={pending}
            topAdditonal={
              !info?.auto_update_all_services && (
                <Stack className="bordered-light" p="md" bdrs="md" gap="sm">
                  <Text size="lg">
                    以下服务有更新：
                  </Text>
                  <Services services={info?.services} />
                </Stack>
              )
            }
          >
            有可用更新
          </ConfirmModalWithDisable>
        </Box>
      )}
      <Box>
        <Button
          title="检查更新"
          variant="outline"
          c="dimmed"
          rightSection={<ICONS.UpdateAvailable size="1rem" />}
          onClick={() => checkForUpdate({ stack: id })}
          loading={checkPending}
        >
          检查
        </Button>
      </Box>
    </>
  );
}

function Services({
  services,
}: {
  services: Types.StackServiceWithUpdate[] | undefined;
}) {
  return (
    <Stack gap="0">
      {services
        ?.filter((service) => service.update_available)
        ?.map((s) => (
          <Group key={s.service} gap="xs">
            <Text c="dimmed">{s.service}</Text>
            <Text c="dimmed"> - </Text>
            <Text>{s.latest_image || s.image}</Text>
          </Group>
        ))}
    </Stack>
  );
}
