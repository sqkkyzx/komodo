import { MonacoEditor } from "mogh_ui";
import { useRead } from "@/lib/hooks";
import { Section, SectionProps } from "mogh_ui";

export interface SwarmStackInspectSectionProps extends SectionProps {
  swarm: string;
  stack: string;
}

export default function SwarmStackInspectSection({
  swarm,
  stack,
  ...sectionProps
}: SwarmStackInspectSectionProps) {
  const {
    data: inspect,
    isPending,
    isError,
  } = useRead("InspectSwarmStack", {
    swarm,
    stack,
  });

  return (
    <Section
      isPending={isPending}
      error={
        isError
          ? "无法检查集群应用栈。"
          : !inspect
            ? `未找到以下名称的集群应用栈：${stack}`
            : undefined
      }
      {...sectionProps}
    >
      <MonacoEditor
        value={JSON.stringify(inspect, null, 2)}
        language="json"
        readOnly
      />
    </Section>
  );
}
