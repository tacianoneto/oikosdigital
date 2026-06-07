import { Fragment, type ReactElement } from "react";
import { resourceAssets, resourceLabels } from "@oikos/content";
import type { Resource } from "@oikos/shared";

const TOKEN_PATTERN = /\[(meat|egg|fruit|seed|point)\]/g;

export function ScenarioDescription({ text }: { text: string }): ReactElement {
  const parts: Array<string | { token: Resource | "point"; key: string }> = [];
  let last = 0;
  let match: RegExpExecArray | null;
  let i = 0;
  TOKEN_PATTERN.lastIndex = 0;
  while ((match = TOKEN_PATTERN.exec(text)) !== null) {
    if (match.index > last) {
      parts.push(text.slice(last, match.index));
    }
    parts.push({ token: match[1] as Resource | "point", key: `t${i++}` });
    last = match.index + match[0].length;
  }
  if (last < text.length) {
    parts.push(text.slice(last));
  }

  return (
    <>
      {parts.map((part, index) => {
        if (typeof part === "string") {
          return <Fragment key={`s${index}`}>{part}</Fragment>;
        }
        const label = part.token === "point" ? "ponto" : resourceLabels[part.token as Resource];
        return (
          <img
            key={part.key}
            className="inline-resource-icon"
            src={encodeURI(resourceAssets[part.token])}
            alt={label}
            title={label}
          />
        );
      })}
    </>
  );
}
