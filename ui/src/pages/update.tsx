import UpdateDetails from "@/components/updates/details";
import { useRead, useSetTitle } from "@/lib/hooks";
import { PageGuard } from "mogh_ui";
import { useParams } from "react-router-dom";

export default function Update() {
  useSetTitle("更新记录");
  const id = useParams().id as string;
  const { data: update, isPending } = useRead(
    "GetUpdate",
    { id },
    { refetchInterval: 10_000 },
  );

  return (
    <PageGuard
      isPending={isPending}
      error={!update ? "未找到更新记录。" : undefined}
    >
      <UpdateDetails updateId={id} />
    </PageGuard>
  );
}
