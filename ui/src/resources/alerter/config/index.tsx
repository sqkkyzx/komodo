import { usePermissions, useRead, useWrite } from "@/lib/hooks";
import { Config } from "mogh_ui";
import { useLocalStorage } from "@mantine/hooks";
import { Types } from "komodo_client";
import AlerterConfigEndpoint from "./endpoint";
import AlerterConfigAlertTypes from "./alert-types";
import AlerterConfigResources from "./resources";
import ConfigMaintenanceWindows from "@/components/maintenance-windows";
import { useFullAlerter } from "..";

export default function AlerterConfig({ id }: { id: string }) {
  const { canWrite } = usePermissions({ type: "Alerter", id });
  const config = useFullAlerter(id)?.config;
  const global_disabled =
    useRead("GetCoreInfo", {}).data?.ui_write_disabled ?? false;
  const { mutateAsync } = useWrite("UpdateAlerter");
  const [update, setUpdate] = useLocalStorage<Partial<Types.AlerterConfig>>({
    key: `alerter-${id}-update-v1`,
    defaultValue: {},
  });

  if (!config) return null;
  const disabled = global_disabled || !canWrite;

  return (
    <Config
      disabled={disabled}
      original={config}
      update={update}
      setUpdate={setUpdate}
      onSave={() => mutateAsync({ id, config: update })}
      groups={{
        "": [
          {
            label: "已启用",
            labelHidden: true,
            fields: {
              enabled: {
                description: "是否向此端点发送告警。",
              },
            },
          },
          {
            label: "端点",
            labelHidden: true,
            fields: {
              endpoint: (endpoint, set) => (
                <AlerterConfigEndpoint
                  endpoint={endpoint!}
                  set={(endpoint) => set({ endpoint })}
                  disabled={disabled}
                />
              ),
            },
          },
          {
            label: "筛选",
            labelHidden: true,
            fields: {
              alert_types: (alertTypes, set) => (
                <AlerterConfigAlertTypes
                  alertTypes={alertTypes!}
                  set={(alert_types) => set({ alert_types })}
                  disabled={disabled}
                />
              ),
              resources: (resources, set) => (
                <AlerterConfigResources
                  resources={resources!}
                  set={(resources) => set({ resources })}
                  disabled={disabled}
                  blacklist={false}
                />
              ),
              except_resources: (resources, set) => (
                <AlerterConfigResources
                  resources={resources!}
                  set={(except_resources) => set({ except_resources })}
                  disabled={disabled}
                  blacklist={true}
                />
              ),
            },
          },
          {
            label: "维护",
            description: (
              <>
                配置维护窗口，在计划维护期间暂停告警。维护窗口生效时，此告警器将不发送告警。
              </>
            ),
            fields: {
              maintenance_windows: (values, set) => {
                return (
                  <ConfigMaintenanceWindows
                    windows={values ?? []}
                    onUpdate={(maintenance_windows) =>
                      set({ maintenance_windows })
                    }
                    disabled={disabled}
                  />
                );
              },
            },
          },
        ],
      }}
    />
  );
}
