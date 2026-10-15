import { lazy } from "react";
import { useSettingsView, useUser } from "@/lib/hooks";
import { Stack } from "@mantine/core";
import SettingsCoreInfo from "./core-info";
import { MobileFriendlyTabs } from "mogh_ui";
import ExportToml from "@/components/export-toml";
import SettingsVariables from "./variables";
import SettingsTags from "./tags";
import SettingsProviders from "./providers";
import { ICONS } from "@/lib/icons";
import SettingsOnboardingKeys from "./onboarding";
import SettingsUsers from "./users";

const Resources = lazy(() => import("@/pages/resources"));

export default function Settings() {
  const user = useUser().data;
  const [view, setView] = useSettingsView();
  const currentView =
    (view === "Users" || view === "Providers") && !user?.admin
      ? "Variables"
      : view;
  return (
    <Stack gap="xl" mb="50vh">
      <SettingsCoreInfo />
      <MobileFriendlyTabs
        value={view}
        onValueChange={setView as any}
        actions={currentView === "Variables" && <ExportToml includeVariables />}
        tabsProps={{ color: "green" }}
        tabs={[
          {
            value: "Variables",
            label: "变量",
            content: <SettingsVariables />,
            icon: ICONS.Variable,
          },
          {
            value: "Tags",
            label: "标签",
            content: <SettingsTags />,
            icon: ICONS.Tag,
          },
          {
            value: "Builders",
            label: "构建器",
            content: <Resources _type="Builder" />,
            icon: ICONS.Builder,
          },
          {
            value: "Alerters",
            label: "告警器",
            content: <Resources _type="Alerter" />,
            icon: ICONS.Alerter,
          },
          {
            value: "Providers",
            label: "提供商",
            content: <SettingsProviders />,
            icon: ICONS.Provider,
          },
          {
            value: "Users",
            label: "用户",
            content: <SettingsUsers />,
            icon: ICONS.User,
            hidden: !user?.admin,
          },
          {
            value: "Onboarding",
            label: "服务器注册",
            content: <SettingsOnboardingKeys />,
            icon: ICONS.OnboardingKey,
          },
        ]}
      />
    </Stack>
  );
}
