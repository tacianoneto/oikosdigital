import type { Resource } from "@oikos/shared";

export const resourceLabels: Record<Resource, string> = {
  meat: "Carne",
  egg: "Ovo",
  fruit: "Fruta",
  seed: "Pinha"
};

export const resourceAssets: Record<Resource | "point", string> = {
  meat: "/assets/resources/Carne.png",
  egg: "/assets/resources/Ovo.png",
  fruit: "/assets/resources/Fruta.png",
  seed: "/assets/resources/Pinha.png",
  point: "/assets/resources/Ponto.png"
};
