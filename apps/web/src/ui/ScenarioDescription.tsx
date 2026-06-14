import type { ReactElement } from "react";
import { ResourceText } from "./ResourceText";

export function ScenarioDescription({ text }: { text: string }): ReactElement {
  return <ResourceText text={text} />;
}
