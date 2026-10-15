import ContainersSection from "@/components/docker/containers-section";
import DockerLabelsSection from "@/components/docker/labels-section";
import DockerOptions from "@/components/docker/options";
import InspectSection from "@/components/inspect-section";
import { useExecute, usePermissions, useRead, useSetTitle } from "@/lib/hooks";
import { useServer } from "@/resources/server";
import ResourceSubPage from "@/resources/sub-page";
import { ICONS } from "@/lib/icons";
import { ConfirmButton } from "mogh_ui";
import { DataTable } from "mogh_ui";
import { Section } from "mogh_ui";
import { Center, Group, Loader, Text } from "@mantine/core";
import { Types } from "komodo_client";
import { useNavigate, useParams } from "react-router-dom";
import { displayLabel } from "@/lib/l10n";

export default function Volume() {
  const { type, id, volume } = useParams() as {
    type: string;
    id: string;
    volume: string;
  };
  if (type !== "servers") {
    return (
      <Center h="50vh">
        <Text>此资源类型没有存储卷。</Text>
      </Center>
    );
  }
  return <VolumeInner serverId={id} volumeName={volume} />;
}

function VolumeInner({
  serverId,
  volumeName,
}: {
  serverId: string;
  volumeName: string;
}) {
  const server = useServer(serverId);
  useSetTitle(`${server?.name} | 存储卷 | ${volumeName}`);
  const nav = useNavigate();

  const { specific } = usePermissions({
    type: "Server",
    id: serverId,
  });

  const {
    data: volume,
    isPending,
    isError,
  } = useRead("InspectVolume", {
    server: serverId,
    volume: volumeName,
  });

  const { mutate: deleteVolume, isPending: deletePending } = useExecute(
    "DeleteVolume",
    {
      onSuccess: () => nav("/servers/" + serverId),
    },
  );

  const containers = useRead(
    "ListContainers",
    {
      server: serverId,
    },
    { refetchInterval: 10_000 },
  ).data?.filter((container) => container.volumes?.includes(volumeName));

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
        <Text>无法检查存储卷。</Text>
      </Center>
    );
  }

  if (!volume) {
    return (
      <Center h="30vh">
        <Text>未找到名为 {volumeName} 的存储卷</Text>
      </Center>
    );
  }

  const unused = containers && containers.length === 0 ? true : false;

  const intention = unused ? "Critical" : "Good";

  return (
    <ResourceSubPage
      entityTypeName="存储卷"
      parentType="Server"
      parentId={serverId}
      name={volumeName}
      icon={ICONS.Volume}
      intent={intention}
      state={unused ? "未使用" : "使用中"}
      info={
        volume.Scope && (
          <Group gap="xs">
            <Text c="dimmed">范围：</Text>
            <Text>{displayLabel(volume.Scope)}</Text>
          </Group>
        )
      }
      executions={
        unused && (
          <ConfirmButton
            color="red"
            icon={<ICONS.Delete size="1rem" />}
            loading={deletePending}
            onClick={() => deleteVolume({ server: serverId, name: volumeName })}
          >
            删除存储卷
          </ConfirmButton>
        )
      }
    >
      {containers && containers.length > 0 && (
        <ContainersSection serverId={serverId} containers={containers} />
      )}

      {/* TOP LEVEL NETWORK INFO */}
      <Section title="详情" icon={<ICONS.Info size="1.3rem" />}>
        <DataTable
          tableKey="volume-info"
          data={[volume]}
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
              accessorKey: "CreatedAt",
              header: "创建时间",
            },
            {
              accessorKey: "UsageData.Size",
              header: "已用空间",
            },
          ]}
        />
        {volume.Options && (
          <DockerOptions options={Object.entries(volume.Options)} />
        )}
      </Section>

      {specific.includes(Types.SpecificPermission.Inspect) && (
        <InspectSection json={volume} showToggle />
      )}

      <DockerLabelsSection labels={volume?.Labels} />
    </ResourceSubPage>
  );
}
