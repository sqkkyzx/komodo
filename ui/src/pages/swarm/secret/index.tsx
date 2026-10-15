import RemoveSwarmResource from "@/components/swarm/remove";
import { useRead, useSetTitle } from "@/lib/hooks";
import ResourceSubPage from "@/resources/sub-page";
import { useSwarm } from "@/resources/swarm";
import { ICONS } from "@/lib/icons";
import { PageGuard } from "mogh_ui";
import { Badge } from "@mantine/core";
import { useParams } from "react-router-dom";
import SwarmSecretTabs from "./tabs";

export default function SwarmSecret() {
  const { id: swarmId, secret: __secret } = useParams() as {
    id: string;
    secret: string;
  };
  const _secret = decodeURIComponent(__secret);
  const swarm = useSwarm(swarmId);
  const inUse = useRead("ListSwarmSecrets", { swarm: swarmId }).data?.find(
    (secret) => secret.ID === _secret || secret.Name === _secret,
  )?.InUse;
  const {
    data: secret,
    isPending,
    isError,
  } = useRead("InspectSwarmSecret", {
    swarm: swarmId,
    secret: _secret,
  });
  useSetTitle(`${swarm?.name} | 机密 | ${secret?.Spec?.Name ?? "未知"}`);

  const intent = inUse ? "Good" : "Critical";

  return (
    <PageGuard
      isPending={isPending}
      error={
        isError
          ? "无法检查集群机密。"
          : !secret
            ? `未找到以下名称的集群机密：${_secret}`
            : undefined
      }
    >
      <ResourceSubPage
        entityTypeName="集群机密"
        parentType="Swarm"
        parentId={swarmId}
        name={secret?.Spec?.Name}
        icon={ICONS.SwarmSecret}
        intent={intent}
        state={
          !inUse && (
            <Badge variant="filled" color="red">
              未使用
            </Badge>
          )
        }
        executions={
          secret?.ID && (
            <RemoveSwarmResource
              swarmId={swarmId}
              type="Secret"
              resourceId={secret.ID}
              resourceName={secret.Spec?.Name}
              disabled={inUse}
            />
          )
        }
      >
        {swarm && (
          <SwarmSecretTabs swarm={swarm} secret={_secret} intent={intent} />
        )}
      </ResourceSubPage>
    </PageGuard>
  );
}
