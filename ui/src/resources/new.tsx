import { resourceLabel } from "@/lib/l10n";
import { ReactNode, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useRead, useWrite } from "@/lib/hooks";
import { UsableResource } from ".";
import { notifications } from "@mantine/notifications";
import { usableResourcePath } from "@/lib/utils";
import { CreateModal } from "mogh_ui";
import { Divider, Stack, Text, TextInput } from "@mantine/core";
import ResourceSelector from "./selector";
import { Types } from "komodo_client";
import { Copy } from "lucide-react";

export interface NewResourceProps<Config> {
  config?: () => Partial<Config>;
  copyId?: string;
  type: UsableResource;
  readableType?: string;
  name?: string;
  extraInputs?: ReactNode;
  showTemplateSelector?: boolean;
}

export default function NewResource<Config>({
  config,
  copyId = "",
  type,
  readableType,
  name: _name = "",
  extraInputs,
  showTemplateSelector: _showTemplateSelector = true,
}: NewResourceProps<Config>) {
  const nav = useNavigate();
  const showTemplateSelector =
    (useRead(`List${type}s`, {
      query: { templates: Types.TemplatesQueryBehavior.Only },
    }).data?.length ?? 0) > 0;

  const { mutateAsync: create, isPending: createPending } = useWrite(
    `Create${type}`,
  );

  const { mutateAsync: copy, isPending: copyPending } = useWrite(`Copy${type}`);

  const [templateId, setTemplateId] = useState(copyId);
  const [name, setName] = useState(_name);

  const onConfirm = async () => {
    if (!name.trim()) {
      notifications.show({ message: "名称不能为空", color: "red" });
      return false;
    }
    try {
      const result = templateId
        ? await copy({ name: name.trim(), id: templateId })
        : await create({ name: name.trim(), config: config?.() ?? {} });
      const resourceId = result._id?.$oid;
      if (resourceId) {
        nav(`/${usableResourcePath(type)}/${resourceId}`);
      }
      return true;
    } catch (error) {
      notifications.show({ message: "发生意外错误。", color: "red" });
      return false;
    }
  };

  return (
    <CreateModal
      entityType={readableType ?? resourceLabel(type)}
      onConfirm={onConfirm}
      disabled={false}
      loading={createPending || copyPending}
      openShiftKeyListener="N"
      leftSection={copyId && <Copy size="1rem" />}
      configSection={() => (
        <Stack>
          <TextInput
            autoFocus
            placeholder={`输入${resourceLabel(type)}名称`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (!name) {
                return;
              }
              if (e.key === "Enter") {
                onConfirm();
              }
            }}
            error={!name.trim() && "输入名称"}
          />

          {!templateId && extraInputs}

          {(!!copyId || (_showTemplateSelector && showTemplateSelector)) && (
            <>
              {!templateId && extraInputs && <Divider />}
              <ResourceSelector
                type={type}
                selected={templateId}
                onSelect={setTemplateId}
                templates={
                  copyId ? undefined : Types.TemplatesQueryBehavior.Only
                }
                wrapperProps={
                  copyId
                    ? {
                        label: (
                          <Text mb="4" size="sm" c="dimmed">
                            复制来源
                          </Text>
                        ),
                      }
                    : undefined
                }
                placeholder="选择模板"
                targetProps={{ w: "100%", maw: "100%" }}
                width="target"
                position="bottom"
                disabled={!!copyId}
                clearable
              />
            </>
          )}
        </Stack>
      )}
    >
      {copyId ? "复制" : null}
    </CreateModal>
  );
}
