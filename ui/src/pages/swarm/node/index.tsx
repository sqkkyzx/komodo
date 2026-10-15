import { displayLabel } from "@/lib/l10n";
import { useParams } from "react-router-dom";
import { swarmNodeStateIntention } from "@/lib/color";
import { useRead, useSetTitle } from "@/lib/hooks";
import { useSwarm } from "@/resources/swarm";
import { ICONS } from "@/lib/icons";
import RemoveSwarmResource from "@/components/swarm/remove";
import ResourceSubPage from "@/resources/sub-page";
import SwarmNodeTabs from "./tabs";
import { PageGuard } from "mogh_ui";
import UpdateSwarmNodes from "@/resources/swarm/docker/nodes/update";

export default function SwarmNode() {
  const { id: swarmId, node: __node } = useParams() as {
    id: string;
    node: string;
  };
  const _node = decodeURIComponent(__node);
  const swarm = useSwarm(swarmId);
  const {
    data: node,
    isPending,
    isError,
  } = useRead("InspectSwarmNode", {
    swarm: swarmId,
    node: _node,
  });
  const state = node?.Status?.State;
  useSetTitle(
    `${swarm?.name} | 节点 | ${node?.Description?.Hostname ?? "未知"}`,
  );

  const intent = swarmNodeStateIntention(state);

  return (
    <PageGuard
      isPending={isPending}
      error={
        isError
          ? "无法检查集群节点。"
          : !node
            ? `未找到以下 ID 的集群节点：${_node}`
            : undefined
      }
    >
      <ResourceSubPage
        entityTypeName="集群节点"
        parentType="Swarm"
        parentId={swarmId}
        name={node?.Description?.Hostname}
        icon={ICONS.SwarmNode}
        intent={intent}
        state={state ? displayLabel(state) : state}
        status={node?.Spec?.Role ? displayLabel(node.Spec.Role) : undefined}
        executions={
          node?.ID && (
            <>
              <UpdateSwarmNodes
                swarm={swarmId}
                nodes={
                  node.Description?.Hostname ? [node.Description?.Hostname] : []
                }
              />
              <RemoveSwarmResource
                swarmId={swarmId}
                type="Node"
                resourceId={node.ID}
                resourceName={node.Description?.Hostname}
              />
            </>
          )
        }
      >
        {swarm && node && (
          <SwarmNodeTabs
            swarm={swarm}
            _node={_node}
            node={node}
            intent={intent}
          />
        )}
      </ResourceSubPage>
    </PageGuard>
  );
}
