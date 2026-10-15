import { resourceLabel } from "@/lib/l10n";
import { ICONS } from "@/lib/icons";
import { usableResourcePath } from "@/lib/utils";
import { SIDEBAR_RESOURCES } from "@/resources";
import { Button, Divider, ScrollArea, Stack, Text } from "@mantine/core";
import { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";

const Sidebar = ({ close }: { close: () => void }) => {
  const location = useLocation().pathname;
  const linkProps = { location, close };
  return (
    <Stack justify="space-between" gap="md" h="96%" m="xl" mt="24" mr="md">
      {/* TOP AREA (scrolling) */}
      <ScrollArea>
        <Stack gap="0.15rem" mr="md">
          <SidebarLink
            label="概览"
            icon={<ICONS.Dashboard size="1rem" />}
            to="/"
            {...linkProps}
          />
          <SidebarLink
            label="容器"
            icon={<ICONS.Container size="1rem" />}
            to="/containers"
            {...linkProps}
          />
          <SidebarLink
            label="终端"
            icon={<ICONS.Terminal size="1rem" />}
            to="/terminals"
            {...linkProps}
          />
          <SidebarLink
            label="统计"
            icon={<ICONS.Stats size="1rem" />}
            to="/stats"
            {...linkProps}
          />

          <Divider
            label={
              <Text opacity={0.7} size="sm">
                资源
              </Text>
            }
            my="0.1rem"
          />

          {SIDEBAR_RESOURCES.map((type) => {
            const Icon = ICONS[type];
            return (
              <SidebarLink
                key={type}
                label={resourceLabel(type)}
                icon={<Icon size="1rem" />}
                to={`/${usableResourcePath(type)}`}
                {...linkProps}
              />
            );
          })}

          <Divider
            label={
              <Text opacity={0.7} size="sm">
                通知
              </Text>
            }
            my="0.1rem"
          />

          <SidebarLink
            label="告警"
            icon={<ICONS.Alert size="1rem" />}
            to="/alerts"
            {...linkProps}
          />
          <SidebarLink
            label="操作记录"
            icon={<ICONS.Update size="1rem" />}
            to="/updates"
            {...linkProps}
          />

          <Divider my="xs" />

          <SidebarLink
            label="计划任务"
            icon={<ICONS.Schedule size="1rem" />}
            to="/schedules"
            {...linkProps}
          />
          <SidebarLink
            label="设置"
            icon={<ICONS.Settings size="1rem" />}
            to="/settings"
            {...linkProps}
          />
        </Stack>
      </ScrollArea>

      {/* BOTTOM AREA */}
      <Stack gap="lg">
        {/* <Button
          onClick={() => nav("/devices")}
          leftSection={<Server size="1rem" />}
          style={{ justifySelf: "flex-end" }}
          fullWidth
        >
          Devices
        </Button> */}
      </Stack>
    </Stack>
  );
};

const SidebarLink = ({
  label,
  icon,
  to,
  location,
  close,
}: {
  label: string;
  icon: ReactNode;
  to: string;
  location: string;
  close: () => void;
}) => {
  return (
    <Button
      variant={
        (to === "/" ? location === "/" : location.startsWith(to))
          ? "default"
          : "subtle"
      }
      component={Link}
      to={to}
      onClick={close}
      leftSection={icon}
      justify="flex-start"
      fullWidth
    >
      {label}
    </Button>
  );
};

export default Sidebar;
