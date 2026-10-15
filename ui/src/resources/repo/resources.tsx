import { ICONS } from "@/lib/icons";
import { Section, SectionProps } from "mogh_ui";
import ResourceTable from "../table";

export interface RepoLinkedResourcesSectionProps extends Omit<
  SectionProps,
  "children"
> {
  repoId: string;
}

export default function RepoLinkedResourcesSection({
  repoId,
  ...sectionProps
}: RepoLinkedResourcesSectionProps) {
  return (
    <Section gap="lg" {...sectionProps}>
      <Section title="应用栈" icon={<ICONS.Stack size="1.3rem" />}>
        <ResourceTable
          type="Stack"
          newProps={{ repoId }}
          specific={{ linked_repos: [repoId] }}
        />
      </Section>
      <Section title="构建" icon={<ICONS.Build size="1.3rem" />}>
        <ResourceTable
          type="Build"
          newProps={{ repoId }}
          specific={{ linked_repos: [repoId] }}
        />
      </Section>
      <Section title="资源同步" icon={<ICONS.ResourceSync size="1.3rem" />}>
        <ResourceTable
          type="ResourceSync"
          newProps={{ repoId }}
          specific={{ linked_repos: [repoId] }}
        />
      </Section>
    </Section>
  );
}
