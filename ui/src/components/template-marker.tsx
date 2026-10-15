import { resourceLabel } from "@/lib/l10n";
import { UsableResource } from "@/resources";
import { Badge, HoverCard, Text } from "@mantine/core";

export const TemplateMarker = ({ type }: { type: UsableResource }) => {
  return (
    <HoverCard>
      <HoverCard.Target>
        <Badge radius="sm" px="0.3rem" color="gray" c="inherit">
          模板
        </Badge>
      </HoverCard.Target>
      <HoverCard.Dropdown>
        <Text>此{resourceLabel(type)}为模板。</Text>
      </HoverCard.Dropdown>
    </HoverCard>
  );
};
