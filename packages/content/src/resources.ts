import type { Resource } from "@oikos/shared";

export const resourceLabels: Record<Resource, string> = {
  meat: "Carne",
  egg: "Ovo",
  fruit: "Fruta",
  seed: "Semente"
};

export const resourceAssets: Record<Resource | "point", string> = {
  meat: "/assets/resources/Carne.webp",
  egg: "/assets/resources/Ovo.webp",
  fruit: "/assets/resources/Fruta.webp",
  seed: "/assets/resources/Pinha.webp",
  point: "/assets/resources/Ponto.webp"
};
