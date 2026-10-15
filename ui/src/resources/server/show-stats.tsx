import { Button } from "@mantine/core";
import { Eye, EyeOff } from "lucide-react";
import { useDashboardPreferences } from "@/lib/hooks";

export default function ServerShowStats() {
  const { preferences, togglePreference } = useDashboardPreferences();
  return (
    <Button
      variant="outline"
      onClick={() => togglePreference("showServerStats")}
      leftSection={
        preferences.showServerStats ? (
          <EyeOff size="1rem" />
        ) : (
          <Eye size="1rem" />
        )
      }
      w={{ base: "100%", xs: "fit-content" }}
    >
      {preferences.showServerStats ? "隐藏服务器统计" : "显示服务器统计"}
    </Button>
  );
}
