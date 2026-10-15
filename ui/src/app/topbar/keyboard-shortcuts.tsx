import { useSettingsView } from "@/lib/hooks";
import {
  ActionIcon,
  Divider,
  Group,
  Kbd,
  Modal,
  SimpleGrid,
  Text,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { Keyboard } from "lucide-react";
import { useShiftKeyListener } from "mogh_ui";
import { useNavigate } from "react-router-dom";

export default function KeyboardShortcuts() {
  const [opened, { open, close }] = useDisclosure();
  const nav = useNavigate();
  const [_, setSettingsView] = useSettingsView();

  useShiftKeyListener("H", () => nav("/"));
  useShiftKeyListener("G", () => nav("/servers"));
  useShiftKeyListener("Z", () => nav("/stacks"));
  useShiftKeyListener("D", () => nav("/deployments"));
  useShiftKeyListener("B", () => nav("/builds"));
  useShiftKeyListener("R", () => nav("/repos"));
  useShiftKeyListener("P", () => nav("/procedures"));
  useShiftKeyListener("X", () => nav("/terminals"));
  useShiftKeyListener("C", () => nav("/schedules"));
  useShiftKeyListener("V", () => {
    setSettingsView("Variables");
    nav("/settings");
  });

  return (
    <>
      <Modal
        opened={opened}
        onClose={close}
        title={<Text size="xl">键盘快捷键</Text>}
        size="lg"
      >
        <SimpleGrid cols={2} p="md" bg="accent.1">
          <KeyboardShortcut label="保存" keys={["Meta", "Enter"]} />
          <KeyboardShortcut label="新建" keys={["Shift", "N"]} />
          <KeyboardShortcut label="返回首页" keys={["Shift", "H"]} />

          <KeyboardShortcut label="前往服务器" keys={["Shift", "G"]} />
          <KeyboardShortcut label="前往应用栈" keys={["Shift", "Z"]} />
          <KeyboardShortcut label="前往部署" keys={["Shift", "D"]} />
          <KeyboardShortcut label="前往构建" keys={["Shift", "B"]} />
          <KeyboardShortcut label="前往代码仓库" keys={["Shift", "R"]} />
          <KeyboardShortcut label="前往流程" keys={["Shift", "P"]} />
          <KeyboardShortcut label="前往变量" keys={["Shift", "V"]} />
          <KeyboardShortcut label="前往终端" keys={["Shift", "X"]} />
          <KeyboardShortcut label="前往计划任务" keys={["Shift", "C"]} />

          <KeyboardShortcut label="搜索" keys={["Shift", "S"]} />
          <KeyboardShortcut label="添加筛选标签" keys={["Shift", "T"]} />
          <KeyboardShortcut
            label="清除筛选标签"
            keys={["Shift", "C"]}
            divider={false}
          />
        </SimpleGrid>
      </Modal>

      <ActionIcon
        size="xl"
        variant="subtle"
        c="inherit"
        visibleFrom="lg"
        onClick={open}
      >
        <Keyboard size="1.3rem" />
      </ActionIcon>
    </>
  );
}

function KeyboardShortcut({
  label,
  keys,
  divider = true,
}: {
  label: string;
  keys: string[];
  divider?: boolean;
}) {
  return (
    <>
      <Text>{label}</Text>
      <Group gap="xs">
        {keys.map((key) => (
          <Kbd key={key}>{key}</Kbd>
        ))}
      </Group>

      {divider && <Divider style={{ gridColumn: "1 / -1" }} />}
    </>
  );
}
