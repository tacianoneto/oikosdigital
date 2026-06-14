import { Fragment, type ReactElement } from "react";
import { resourceAssets, resourceLabels } from "@oikos/content";
import type { Resource } from "@oikos/shared";

const RESOURCE_PATTERN = /\[(meat|egg|fruit|seed|point)\]|\b(carnes?|ovos?|frutas?|sementes?)\b/gi;

const resourceByWord: Record<string, Resource> = {
  carne: "meat",
  carnes: "meat",
  ovo: "egg",
  ovos: "egg",
  fruta: "fruit",
  frutas: "fruit",
  semente: "seed",
  sementes: "seed"
};

export function ResourceIcon({
  resource,
  label,
  className = "inline-resource-icon"
}: {
  resource: Resource | "point";
  label?: string;
  className?: string;
}): ReactElement {
  const accessibleLabel = label ?? (resource === "point" ? "ponto" : resourceLabels[resource]);

  return (
    <img
      className={className}
      data-resource={resource === "point" ? undefined : resource}
      src={encodeURI(resourceAssets[resource])}
      alt={accessibleLabel}
      title={accessibleLabel}
    />
  );
}

export function ResourceText({ text }: { text: string }): ReactElement {
  const parts: Array<string | { resource: Resource | "point"; label: string; key: string }> = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let iconIndex = 0;

  RESOURCE_PATTERN.lastIndex = 0;
  while ((match = RESOURCE_PATTERN.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const token = match[1]?.toLowerCase();
    const word = match[2]?.toLowerCase();
    const resource = (token as Resource | "point" | undefined) ?? resourceByWord[word];
    const label = match[2] ?? (resource === "point" ? "ponto" : resourceLabels[resource as Resource]);
    parts.push({ resource, label, key: `resource-${iconIndex++}` });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return (
    <>
      {parts.map((part, index) =>
        typeof part === "string" ? (
          <Fragment key={`text-${index}`}>{part}</Fragment>
        ) : (
          <ResourceIcon key={part.key} resource={part.resource} label={part.label} />
        )
      )}
    </>
  );
}
