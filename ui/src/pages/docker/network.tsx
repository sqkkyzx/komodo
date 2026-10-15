import { useExecute, usePermissions, useRead, useSetTitle } from "@/lib/hooks";
import DockerLabelsSection from "@/components/docker/labels-section";
import DockerResourceLink from "@/components/docker/link";
import DockerOptions from "@/components/docker/options";
import InspectSection from "@/components/inspect-section";
import { useServer } from "@/resources/server";
import ResourceSubPage from "@/resources/sub-page";
import { ICONS } from "@/lib/icons";
import { ConfirmButton } from "mogh_ui";
import { DataTable, SortableHeader } from "mogh_ui";
import { Section } from "mogh_ui";
import { Center, Group, Loader, Text } from "@mantine/core";
import { Types } from "komodo_client";
import { Waypoints } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { displayLabel } from "@/lib/l10n";

export default function Network() {
  const { type, id, network } = useParams() as {
    type: string;
    id: string;
    network: string;
  };
  if (type !== "servers") {
    return (
      <Center h="50vh">
        <Text>此资源类型没有网络。</Text>
      </Center>
    );
  }
  return <NetworkInner serverId={id} networkName={network} />;
}

function NetworkInner({
  serverId,
  networkName,
}: {
  serverId: string;
  networkName: string;
}) {
  const server = useServer(serverId);
  useSetTitle(`${server?.name} | 网络 | ${networkName}`);
  const nav = useNavigate();

  const { specific } = usePermissions({
    type: "Server",
    id: serverId,
  });

  const {
    data: network,
    isPending,
    isError,
  } = useRead("InspectNetwork", {
    server: serverId,
    network: networkName,
  });

  const { mutate: deleteNetwork, isPending: deletePending } = useExecute(
    "DeleteNetwork",
    {
      onSuccess: () => nav("/servers/" + serverId),
    },
  );

  if (isPending) {
    return (
      <Center h="30vh">
        <Loader size="xl" />
      </Center>
    );
  }

  if (isError) {
    return (
      <Center h="30vh">
        <Text>无法检查网络。</Text>
      </Center>
    );
  }

  if (!network) {
    return (
      <Center h="30vh">
        <Text>未找到名为 {networkName} 的网络</Text>
      </Center>
    );
  }

  const containers = Object.values(network.Containers ?? {});
  const ipamDriver = network.IPAM?.Driver;
  const ipamConfig =
    network.IPAM?.Config.map((config) => ({
      ...config,
      Driver: ipamDriver,
    })) ?? [];

  const unused =
    !["none", "host", "bridge"].includes(networkName) &&
    containers &&
    containers.length === 0
      ? true
      : false;

  const intention = unused ? "Critical" : "Good";

  return (
    <ResourceSubPage
      entityTypeName="网络"
      parentType="Server"
      parentId={serverId}
      name={networkName}
      icon={ICONS.Network}
      intent={intention}
      state={unused ? "未使用" : "使用中"}
      info={
        <>
          <Group gap="xs">
            <Text c="dimmed">IPv6：</Text>
            <Text>{network.EnableIPv6 ? "已启用" : "已禁用"}</Text>
          </Group>
          {network.Id && (
            <Group gap="xs">
              <Text c="dimmed">ID：</Text>
              <Text title={network.Id} maw={150} className="text-ellipsis">
                {network.Id}
              </Text>
            </Group>
          )}
        </>
      }
      executions={
        unused ? (
          <ConfirmButton
            variant="filled"
            color="red"
            icon={<ICONS.Delete size="1rem" />}
            loading={deletePending}
            onClick={() =>
              deleteNetwork({ server: serverId, name: networkName })
            }
          >
            删除网络
          </ConfirmButton>
        ) : undefined
      }
    >
      {containers && containers.length > 0 && (
        <Section title="容器" icon={<ICONS.Container size="1.3rem" />}>
          <DataTable
            tableKey="network-containers"
            data={containers}
            columns={[
              {
                accessorKey: "Name",
                header: ({ column }) => (
                  <SortableHeader column={column} title="名称" />
                ),
                cell: ({ row }) =>
                  row.original.Name ? (
                    <DockerResourceLink
                      type="Container"
                      serverId={serverId}
                      name={row.original.Name}
                    />
                  ) : (
                    "未知"
                  ),
              },
              {
                accessorKey: "IPv4Address",
                header: ({ column }) => (
                  <SortableHeader column={column} title="IPv4" />
                ),
                cell: ({ row }) => row.original.IPv4Address || "无",
              },
              {
                accessorKey: "IPv6Address",
                header: ({ column }) => (
                  <SortableHeader column={column} title="IPv6" />
                ),
                cell: ({ row }) => row.original.IPv6Address || "无",
              },
              {
                accessorKey: "MacAddress",
                header: ({ column }) => (
                  <SortableHeader column={column} title="MAC 地址" />
                ),
                cell: ({ row }) => row.original.MacAddress || "无",
              },
            ]}
          />
        </Section>
      )}

      {/* TOP LEVEL NETWORK INFO */}
      <Section title="详情" icon={<ICONS.Info size="1.3rem" />}>
        <DataTable
          tableKey="network-info"
          data={[network]}
          columns={[
            {
              accessorKey: "Driver",
              header: "驱动",
            },
            {
              accessorKey: "Scope",
              header: "范围",
              cell: ({ row }) => displayLabel(row.original.Scope),
            },
            {
              accessorKey: "Attachable",
              header: "允许独立容器连接",
              cell: ({ row }) =>
                row.original.Attachable == null
                  ? "-"
                  : row.original.Attachable
                    ? "是"
                    : "否",
            },
            {
              accessorKey: "Internal",
              header: "内部网络",
              cell: ({ row }) =>
                row.original.Internal == null
                  ? "-"
                  : row.original.Internal
                    ? "是"
                    : "否",
            },
          ]}
        />
        {network.Options && (
          <DockerOptions options={Object.entries(network.Options)} />
        )}
      </Section>

      {ipamConfig.length > 0 && (
        <Section title="IPAM" icon={<Waypoints size="1.3rem" />}>
          <DataTable
            tableKey="network-ipam"
            data={ipamConfig}
            columns={[
              {
                accessorKey: "Driver",
                header: "驱动",
              },
              {
                accessorKey: "Subnet",
                header: "子网",
              },
              {
                accessorKey: "Gateway",
                header: "网关",
              },
              {
                accessorKey: "IPRange",
                header: "IP 范围",
              },
            ]}
          />
          {network.IPAM?.Options && (
            <DockerOptions options={Object.entries(network.IPAM.Options)} />
          )}
        </Section>
      )}

      {specific.includes(Types.SpecificPermission.Inspect) && (
        <InspectSection json={network} showToggle />
      )}

      <DockerLabelsSection labels={network?.Labels} />
    </ResourceSubPage>
  );
}
