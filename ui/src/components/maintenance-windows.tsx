import { displayLabel } from "@/lib/l10n";
import {
  ActionIcon,
  Button,
  Group,
  Modal,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  TextInput,
} from "@mantine/core";
import { Types } from "komodo_client";
import { useState } from "react";
import { DataTable, SortableHeader } from "mogh_ui";
import { Calendar, CalendarDays, Clock } from "lucide-react";
import { fmtMaintenanceWindowTime } from "@/lib/formatting";
import { ICONS } from "@/lib/icons";
import TimezoneSelector from "./timezone-selector";

export interface ConfigMaintenanceWindowsProps {
  windows: Types.MaintenanceWindow[];
  onUpdate: (windows: Types.MaintenanceWindow[]) => void;
  disabled?: boolean;
}

export default function ConfigMaintenanceWindows({
  windows,
  onUpdate,
  disabled,
}: ConfigMaintenanceWindowsProps) {
  const [editingWindow, setEditingWindow] = useState<
    -1 | [number, Types.MaintenanceWindow] | null
  >(null);

  const addWindow = (newWindow: Types.MaintenanceWindow) => {
    onUpdate([...windows, newWindow]);
    setEditingWindow(null);
  };

  const updateWindow = (
    index: number,
    updatedWindow: Types.MaintenanceWindow,
  ) => {
    onUpdate(windows.map((w, i) => (i === index ? updatedWindow : w)));
    setEditingWindow(null);
  };

  const deleteWindow = (index: number) => {
    onUpdate(windows.filter((_, i) => i !== index));
  };

  const toggleWindow = (index: number, enabled: boolean) => {
    onUpdate(windows.map((w, i) => (i === index ? { ...w, enabled } : w)));
  };

  return (
    <>
      <Stack gap="xs">
        {!disabled && (
          <Button
            leftSection={<ICONS.Create size="1rem" />}
            onClick={() => setEditingWindow(-1)}
            w={{ base: "85%", lg: 400 }}
          >
            添加维护窗口
          </Button>
        )}

        {windows.length ? (
          <DataTable
            tableKey="maintenance-windows"
            data={windows}
            columns={[
              {
                accessorKey: "name",
                header: ({ column }) => (
                  <SortableHeader column={column} title="名称" />
                ),
                cell: ({ row }) => (
                  <Group>
                    <ScheduleIcon
                      scheduleType={
                        row.original.schedule_type ??
                        Types.MaintenanceScheduleType.Daily
                      }
                    />
                    <Text>{row.original.name}</Text>
                  </Group>
                ),
              },
              {
                accessorKey: "schedule_type",
                header: ({ column }) => (
                  <SortableHeader column={column} title="计划" />
                ),
                cell: ({ row }) => (
                  <ScheduleDescription window={row.original} />
                ),
              },
              {
                accessorKey: "start_time",
                header: ({ column }) => (
                  <SortableHeader column={column} title="开始时间" />
                ),
                cell: ({ row }) => fmtMaintenanceWindowTime(row.original),
              },
              {
                accessorKey: "duration_minutes",
                header: ({ column }) => (
                  <SortableHeader column={column} title="持续时间" />
                ),
                accessorFn: (row) => `${row.duration_minutes} 分钟`,
              },
              {
                accessorKey: "enabled",
                header: ({ column }) => (
                  <SortableHeader column={column} title="已启用" />
                ),
                cell: ({ row }) => (
                  <Switch
                    checked={row.original.enabled}
                    onChange={(e) => toggleWindow(row.index, e.target.checked)}
                    disabled={disabled}
                  />
                ),
              },
              {
                id: "actions",
                header: "操作",
                cell: ({ row }) =>
                  !disabled && (
                    <Group gap="xs">
                      <ActionIcon
                        onClick={() =>
                          setEditingWindow([row.index, row.original])
                        }
                      >
                        <ICONS.Edit size="1rem" />
                      </ActionIcon>
                      <ActionIcon
                        variant="filled"
                        color="red"
                        onClick={() => deleteWindow(row.index)}
                      >
                        <ICONS.Delete size="1rem" />
                      </ActionIcon>
                    </Group>
                  ),
              },
            ]}
          />
        ) : undefined}
      </Stack>

      <Modal
        title={
          <Text size="xl">
            {editingWindow === -1 ? "创建" : "编辑"} 维护窗口
          </Text>
        }
        opened={!!editingWindow}
        onClose={() => setEditingWindow(null)}
        size="lg"
      >
        {editingWindow && (
          <MaintenanceWindowForm
            initialData={editingWindow === -1 ? undefined : editingWindow[1]}
            onSave={(window) =>
              editingWindow === -1
                ? addWindow(window)
                : updateWindow(editingWindow[0], window)
            }
            onCancel={() => setEditingWindow(null)}
          />
        )}
      </Modal>
    </>
  );
}

function ScheduleIcon({
  scheduleType,
}: {
  scheduleType: Types.MaintenanceScheduleType;
}) {
  switch (scheduleType) {
    case "Daily":
      return <Clock size="1rem" />;
    case "Weekly":
      return <Calendar size="1rem" />;
    case "OneTime":
      return <CalendarDays size="1rem" />;
    default:
      return <Clock size="1rem" />;
  }
}

function ScheduleDescription({
  window,
}: {
  window: Types.MaintenanceWindow;
}): string {
  switch (window.schedule_type) {
    case "Daily":
      return "每天";
    case "Weekly":
      return `每周（${displayLabel(window.day_of_week || "Monday")}）`;
    case "OneTime":
      return `单次（${window.date || "未设置日期"}）`;
    default:
      return "未知";
  }
}

interface MaintenanceWindowFormProps {
  initialData?: Types.MaintenanceWindow;
  onSave: (window: Types.MaintenanceWindow) => void;
  onCancel: () => void;
}

function MaintenanceWindowForm({
  initialData,
  onSave,
  onCancel,
}: MaintenanceWindowFormProps) {
  const [formData, setFormData] = useState<Types.MaintenanceWindow>(
    initialData || {
      name: "",
      description: "",
      schedule_type: Types.MaintenanceScheduleType.Daily,
      day_of_week: "",
      date: "",
      hour: 5,
      minute: 0,
      timezone: "",
      duration_minutes: 60,
      enabled: true,
    },
  );

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = "名称不能为空";
    }

    if (formData.hour! < 0 || formData.hour! > 23) {
      newErrors.hour = "小时必须在 0 到 23 之间";
    }

    if (formData.minute! < 0 || formData.minute! > 59) {
      newErrors.minute = "分钟必须在 0 到 59 之间";
    }

    if (formData.duration_minutes <= 0) {
      newErrors.duration = "持续时间必须大于 0";
    }

    if (formData.schedule_type && formData.schedule_type === "OneTime") {
      const date = formData.date;
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        newErrors.date = "日期必须采用 YYYY-MM-DD 格式";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (validate()) {
      onSave(formData);
    }
  };

  const updateScheduleType = (schedule_type: Types.MaintenanceScheduleType) => {
    setFormData((data) => ({
      ...data,
      schedule_type,
      day_of_week:
        schedule_type === Types.MaintenanceScheduleType.Weekly ? "Monday" : "",
      date:
        schedule_type === Types.MaintenanceScheduleType.OneTime
          ? new Date().toISOString().split("T")[0]
          : "",
    }));
  };

  return (
    <Stack gap="xs">
      <TextInput
        value={formData.name}
        onChange={(e) =>
          setFormData((data) => ({ ...data, name: e.target.value }))
        }
        placeholder="例如：每日备份"
        label="名称"
        error={errors.name}
      />

      <Select
        value={formData.schedule_type}
        onChange={(value) =>
          value && updateScheduleType(value as Types.MaintenanceScheduleType)
        }
        label="计划类型"
        data={Object.values(Types.MaintenanceScheduleType).map((value) => ({
          value,
          label: displayLabel(value),
        }))}
      />

      {formData.schedule_type === "Weekly" && (
        <Select
          value={formData.schedule_type as string}
          onChange={(value) =>
            value &&
            setFormData((data) => ({
              ...data,
              day_of_week: value,
            }))
          }
          label="星期"
          data={Object.values(Types.DayOfWeek).map((value) => ({
            value,
            label: displayLabel(value),
          }))}
        />
      )}

      {formData.schedule_type === "OneTime" && (
        <TextInput
          label="日期"
          type="date"
          value={formData.date || new Date().toISOString().split("T")[0]}
          onChange={(e) =>
            setFormData({
              ...formData,
              date: e.target.value,
            })
          }
          error={errors.date}
        />
      )}

      <SimpleGrid cols={{ base: 1, sm: 2 }}>
        <TextInput
          label="开始时间"
          type="time"
          value={`${formData.hour!.toString().padStart(2, "0")}:${formData.minute!.toString().padStart(2, "0")}`}
          onChange={(e) => {
            const [hour, minute] = e.target.value
              .split(":")
              .map((n) => parseInt(n) || 0);
            setFormData({
              ...formData,
              hour,
              minute,
            });
          }}
          error={errors.hour || errors.minute}
          w="100%"
        />
        <TimezoneSelector
          label="时区"
          timezone={formData.timezone ?? ""}
          onChange={(timezone) =>
            setFormData((data) => ({ ...data, timezone }))
          }
          w="100%"
        />
      </SimpleGrid>

      <TextInput
        label="持续时间（分钟）"
        type="number"
        min={1}
        value={formData.duration_minutes}
        onChange={(e) =>
          setFormData((data) => ({
            ...data,
            duration_minutes: parseInt(e.target.value) || 60,
          }))
        }
        error={errors.duration}
      />

      <TextInput
        label="描述（可选）"
        value={formData.description}
        onChange={(e) =>
          setFormData((data) => ({ ...data, description: e.target.value }))
        }
        placeholder="例如：自动备份过程"
      />

      <Group justify="end" mt="xs">
        <Button
          variant="outline"
          onClick={onCancel}
          leftSection={<ICONS.Cancel size="1rem" />}
        >
          取消
        </Button>
        <Button onClick={handleSave} leftSection={<ICONS.Check size="1rem" />}>
          {initialData ? "更新" : "创建"}
        </Button>
      </Group>
    </Stack>
  );
}
