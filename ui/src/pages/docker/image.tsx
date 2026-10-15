import ContainersSection from "@/components/docker/containers-section";
import DockerLabelsSection from "@/components/docker/labels-section";
import InspectSection from "@/components/inspect-section";
import { useExecute, usePermissions, useRead, useSetTitle } from "@/lib/hooks";
import { useServer } from "@/resources/server";
import ResourceSubPage from "@/resources/sub-page";
import { ICONS } from "@/lib/icons";
import { ConfirmButton, fmtDateWithMinutes, fmtSizeBytes } from "mogh_ui";
import { DataTable } from "mogh_ui";
import { PageGuard } from "mogh_ui";
import { Section } from "mogh_ui";
import { ShowHideButton } from "mogh_ui";
import { Box, Center, Group, Text } from "@mantine/core";
import { Types } from "komodo_client";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

export default function Image() {
  const { type, id, image } = useParams() as {
    type: string;
    id: string;
    image: string;
  };
  if (type !== "servers") {
    return (
      <Center h="50vh">
        <Text>此资源类型没有镜像。</Text>
      </Center>
    );
  }
  return <ImageInner serverId={id} imageName={image} />;
}

function ImageInner({
  serverId,
  imageName,
}: {
  serverId: string;
  imageName: string;
}) {
  const [showHistory, setShowHistory] = useState(false);
  const server = useServer(serverId);
  useSetTitle(`${server?.name} | 镜像 | ${imageName}`);
  const nav = useNavigate();

  const { specific } = usePermissions({
    type: "Server",
    id: serverId,
  });

  const {
    data: image,
    isPending,
    isError,
  } = useRead("InspectImage", {
    server: serverId,
    image: imageName,
  });

  const containers = useRead(
    "ListContainers",
    {
      server: serverId,
    },
    { refetchInterval: 10_000 },
  ).data?.filter((container) =>
    !image?.Id ? false : container.image_id === image?.Id,
  );

  const history = useRead("ListImageHistory", {
    server: serverId,
    image: imageName,
  }).data;

  const { mutate: deleteImage, isPending: deletePending } = useExecute(
    "DeleteImage",
    {
      onSuccess: () => nav("/servers/" + serverId),
    },
  );

  const unused = containers && containers.length === 0 ? true : false;
  const intention = unused ? "Critical" : "Good";

  return (
    <PageGuard
      isPending={isPending}
      error={
        isError
          ? "无法检查镜像。"
          : !image
            ? "未找到以下名称的镜像：" + imageName
            : undefined
      }
    >
      {image && (
        <ResourceSubPage
          entityTypeName="镜像"
          parentType="Server"
          parentId={serverId}
          name={imageName}
          icon={ICONS.Image}
          intent={intention}
          state={unused ? "未使用" : "使用中"}
          info={
            image.Id && (
              <Group gap="xs">
                <Text>ID：</Text>
                <Text title={image.Id} maw={150} className="text-ellipsis">
                  {image.Id}
                </Text>
              </Group>
            )
          }
          executions={
            unused && (
              <ConfirmButton
                variant="filled"
                color="red"
                icon={<ICONS.Delete size="1rem" />}
                loading={deletePending}
                onClick={() =>
                  deleteImage({ server: serverId, name: imageName })
                }
              >
                删除镜像
              </ConfirmButton>
            )
          }
        >
          {containers && containers.length > 0 && (
            <ContainersSection serverId={serverId} containers={containers} />
          )}

          {/* TOP LEVEL IMAGE INFO */}
          <Section title="详情" icon={<ICONS.Info size="1.3rem" />}>
            <DataTable
              tableKey="image-info"
              data={[image]}
              columns={[
                {
                  accessorKey: "Architecture",
                  header: "架构",
                },
                {
                  accessorKey: "Os",
                  header: "操作系统",
                },
                {
                  accessorKey: "Size",
                  header: "大小",
                  cell: ({ row }) =>
                    row.original.Size
                      ? fmtSizeBytes(row.original.Size)
                      : "未知",
                },
              ]}
            />
          </Section>

          {history && history.length > 0 && (
            <Section
              title="历史记录"
              icon={<ICONS.History size="1.3rem" />}
              titleRight={
                <Box pl="md">
                  <ShowHideButton show={showHistory} setShow={setShowHistory} />
                </Box>
              }
            >
              {showHistory && (
                <DataTable
                  tableKey="image-history"
                  data={history.toReversed()}
                  columns={[
                    {
                      accessorKey: "CreatedBy",
                      header: "创建命令",
                    },
                    {
                      accessorKey: "Created",
                      header: "时间",
                      cell: ({ row }) =>
                        fmtDateWithMinutes(
                          new Date(row.original.Created * 1000),
                        ),
                    },
                  ]}
                />
              )}
            </Section>
          )}

          {specific.includes(Types.SpecificPermission.Inspect) && (
            <InspectSection json={image} showToggle />
          )}

          <DockerLabelsSection labels={image?.Config?.Labels} />
        </ResourceSubPage>
      )}
    </PageGuard>
  );
}
