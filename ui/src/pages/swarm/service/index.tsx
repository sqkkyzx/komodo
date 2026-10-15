import { displayLabel } from "@/lib/l10n";
import SwarmResourceLink from "@/components/swarm/link";
import RemoveSwarmResource from "@/components/swarm/remove";
import { swarmStateIntention } from "@/lib/color";
import { useRead, useSetTitle } from "@/lib/hooks";
import ResourceSubPage from "@/resources/sub-page";
import { useSwarm } from "@/resources/swarm";
import { ICONS } from "@/lib/icons";
import { PageGuard } from "mogh_ui";
import { useParams } from "react-router-dom";
import SwarmServiceTabs from "./tabs";

export default function SwarmService() {
  const { id: swarmId, service: __service } = useParams() as {
    id: string;
    service: string;
  };
  const _service = decodeURIComponent(__service);
  const swarm = useSwarm(swarmId);
  const {
    data: services,
    isPending,
    isError,
  } = useRead("ListSwarmServices", {
    swarm: swarmId,
  });
  const service = services?.find(
    (service) =>
      _service &&
      // First match on name here.
      // Then better to match on ID start to accept short ids too.
      (service.Name === _service || service.ID?.startsWith(_service)),
  );
  const tasks =
    useRead("ListSwarmTasks", {
      swarm: swarmId,
    }).data?.filter((task) => service?.ID && task.ServiceID === service.ID) ??
    [];
  useSetTitle(
    `${swarm?.name} | 服务 | ${service?.Name ?? service?.ID ?? "未知"}`,
  );

  const state = service?.State;
  const intent = swarmStateIntention(state);

  return (
    <PageGuard
      isPending={isPending}
      error={
        isError
          ? "无法检查集群服务。"
          : !service
            ? `未找到以下名称的集群服务：${_service}`
            : undefined
      }
    >
      <ResourceSubPage
        entityTypeName="集群服务"
        parentType="Swarm"
        parentId={swarmId}
        name={service?.Name}
        icon={ICONS.SwarmService}
        intent={intent}
        state={state ? displayLabel(state) : state}
        status={`${tasks.length} 个任务`}
        info={
          <>
            {service?.Configs.map((config) => (
              <SwarmResourceLink
                key={config}
                type="Config"
                swarmId={swarmId}
                resourceId={config}
                name={config}
              />
            ))}
            {service?.Secrets.map((secret) => (
              <SwarmResourceLink
                key={secret}
                type="Secret"
                swarmId={swarmId}
                resourceId={secret}
                name={secret}
              />
            ))}
          </>
        }
        executions={
          service?.Name && (
            <RemoveSwarmResource
              swarmId={swarmId}
              type="Service"
              resourceId={service?.Name}
            />
          )
        }
      >
        {swarm && service && (
          <SwarmServiceTabs
            swarm={swarm}
            serviceId={service.ID}
            service={_service}
            intent={intent}
          />
        )}
      </ResourceSubPage>
    </PageGuard>
  );
}
