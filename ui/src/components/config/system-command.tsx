import { Checkbox, Code, Stack, TextInput } from "@mantine/core";
import { Types } from "komodo_client";
import { MonacoEditor } from "mogh_ui";

export interface SystemCommandProps {
  value?: Types.SystemCommand;
  disabled: boolean;
  set: (value: Types.SystemCommand) => void;
}

export default function SystemCommand({
  value,
  disabled,
  set,
}: SystemCommandProps) {
  const placeholder = value?.shell_mode
    ? "  # 添加要运行的命令。\n  "
    : "  # 每行添加一条命令。支持注释和转义换行。\n  ";
  return (
    <Stack>
      <TextInput
        label="路径"
        placeholder="命令工作目录"
        value={value?.path}
        w={{ base: "85%", sm: 300 }}
        onChange={(e) => set({ ...(value || {}), path: e.target.value })}
        disabled={disabled}
      />
      <Checkbox
        label={
          <>
            以 Shell 模式运行（
            <Code fz="sm" p="0">
              sh -c
            </Code>
            ）{" "}
          </>
        }
        checked={value?.shell_mode ?? false}
        onChange={(e) =>
          set({
            ...(value || {}),
            shell_mode: e.currentTarget.checked,
          })
        }
        disabled={disabled}
      />
      <MonacoEditor
        value={value?.command || placeholder}
        language="shell"
        onValueChange={(command) => set({ ...(value || {}), command })}
        readOnly={disabled}
      />
    </Stack>
  );
}
