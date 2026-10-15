import { useInvalidate, usePermissions, useRead, useWrite } from "@/lib/hooks";
import { UsableResource } from ".";
import { notifications } from "@mantine/notifications";
import { TextUpdateModal } from "mogh_ui";
import { Button, Text } from "@mantine/core";
import { resourceLabel } from "@/lib/l10n";

export default function ResourceDescription({
  type,
  id,
}: {
  type: UsableResource;
  id: string;
}) {
  const { canWrite } = usePermissions({ type, id });
  const inv = useInvalidate();
  const key = type === "ResourceSync" ? "sync" : type.toLowerCase();

  const resource = useRead(`Get${type}`, {
    [key]: id,
  } as any).data;

  const { mutate: updateDescription } = useWrite("UpdateResourceMeta", {
    onSuccess: () => {
      inv([`Get${type}`]);
      notifications.show({
        message: `已更新${resourceLabel(type)}“${resource?.name}”的描述`,
      });
    },
  });

  return (
    <TextUpdateModal
      title={`更新${resourceLabel(type)}描述`}
      placeholder="设置描述"
      value={resource?.description}
      onUpdate={(description) =>
        updateDescription({ target: { type, id }, description })
      }
      disabled={!canWrite}
      target={(open) => (
        <Button
          variant="transparent"
          c="dimmed"
          p="md"
          className="bordered-light"
          bdrs="md"
          w="100%"
          h="100%"
          justify="start"
          styles={{
            label: {
              height: "fit-content",
              color: "var(--mantine-color-dimmed-0)",
            },
            inner: { alignItems: "start" },
          }}
          onClick={open}
        >
          <Text
            className="text-ellipsis"
            maw={{ base: 350, md: 600, xl2: 750, xl3: 900, xl4: 1050 }}
          >
            {resource?.description?.split("\n")[0] || "设置描述"}
          </Text>
        </Button>
      )}
    />
  );
}
