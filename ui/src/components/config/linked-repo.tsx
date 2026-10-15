import ResourceLink from "@/resources/link";
import ResourceSelector from "@/resources/selector";
import { ConfigItem } from "mogh_ui";
import { Group } from "@mantine/core";

export interface LinkedRepoProps {
  linkedRepo: string | undefined;
  repoLinked: boolean;
  set: (update: {
    /// KEEP as snake case, these are being passed to backend.
    linked_repo: string;
    // Set other props back to default.
    git_provider: string;
    git_account: string;
    git_https: boolean;
    repo: string;
    branch: string;
    commit: string;
  }) => void;
  disabled: boolean;
}

export default function LinkedRepo({
  linkedRepo,
  repoLinked,
  set,
  disabled,
}: LinkedRepoProps) {
  return (
    <ConfigItem
      label={
        linkedRepo ? (
          <Group fz="h3" fw="bold">
            代码仓库：
            <ResourceLink
              type="Repo"
              id={linkedRepo}
              fz="h3"
              iconSize="1.2rem"
            />
          </Group>
        ) : (
          "选择代码仓库"
        )
      }
      description={`选择已有代码仓库进行关联${!repoLinked ? "，或在下方配置代码仓库" : ""}。`}
    >
      <ResourceSelector
        type="Repo"
        selected={linkedRepo}
        onSelect={(linkedRepo) => {
          set({
            linked_repo: linkedRepo,
            // Set other props back to default
            git_provider: "github.com",
            git_account: "",
            git_https: true,
            repo: linkedRepo ? "" : "namespace/repo",
            branch: "main",
            commit: "",
          });
        }}
        disabled={disabled}
        clearable
      />
    </ConfigItem>
  );
}
