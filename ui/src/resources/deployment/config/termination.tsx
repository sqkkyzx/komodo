import { ConfigItem } from "mogh_ui";
import { Group, Select, TextInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { Types } from "komodo_client";
import { useEffect, useState } from "react";

export function TerminationSignal({
  arg,
  set,
  disabled,
}: {
  arg?: Types.TerminationSignal;
  set: (input: Partial<Types.DeploymentConfig>) => void;
  disabled: boolean;
}) {
  return (
    <ConfigItem label="默认终止信号">
      <Select
        value={arg}
        onChange={(value) =>
          value && set({ termination_signal: value as Types.TerminationSignal })
        }
        disabled={disabled}
        placeholder="选择信号"
        data={Object.values(Types.TerminationSignal).reverse()}
        w={{ base: "100%", xs: "fit-content" }}
      />
    </ConfigItem>
  );
}

export function TerminationTimeout({
  arg,
  set,
  disabled,
}: {
  arg: number;
  set: (input: Partial<Types.DeploymentConfig>) => void;
  disabled: boolean;
}) {
  const [input, setInput] = useState(arg.toString());
  useEffect(() => {
    setInput(arg.toString());
  }, [arg]);
  const num = Number(input);
  const error = num || num === 0 ? undefined : "超时必须为数字";
  return (
    <ConfigItem label="终止超时">
      <Group gap="xs">
        <TextInput
          w={100}
          placeholder="以秒为单位"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onBlur={(e) => {
            const num = Number(e.target.value);
            if (num || num === 0) {
              set({ termination_timeout: num });
            } else {
              notifications.show({
                message: "终止超时必须为数字",
                color: "red",
              });
            }
          }}
          error={error}
          disabled={disabled}
        />
        秒
      </Group>
    </ConfigItem>
  );
}
