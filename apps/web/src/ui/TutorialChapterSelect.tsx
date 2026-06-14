import type { CSSProperties, ReactNode } from "react";
import { Check, ChevronLeft, GraduationCap, Lock, Play } from "lucide-react";
import { speciesDefinitions } from "@oikos/content";
import type { SpeciesId } from "@oikos/shared";
import { ResourceText } from "./ResourceText";
import { SPECIES_HEX, speciesList } from "./gameConstants";
import type { TutorialId } from "./tutorials";

export type TutorialCompletionState = Record<TutorialId, boolean>;

interface TutorialChapterSelectProps {
  completed: TutorialCompletionState;
  onBack: () => void;
  onStart: (tutorialId: TutorialId) => void;
}

interface SpeciesChapter {
  id: Exclude<TutorialId, "initial">;
  speciesId: SpeciesId;
  description: string;
  richDescription?: boolean;
}

const SPECIES_CHAPTERS: SpeciesChapter[] = [
  {
    id: "jaguar",
    speciesId: "jaguar",
    description: "O predador: cace peças e gaste carne por pontos.",
    richDescription: true
  },
  {
    id: "wolf",
    speciesId: "maned_wolf",
    description: "Mova a alcateia, remova espécies de base e converta recursos em pontos."
  },
  {
    id: "armadillo",
    speciesId: "armadillo",
    description: "Espalhe 4 tatus, faça 3 pontos e teste a carapaça contra a Onça."
  },
  {
    id: "macaw",
    speciesId: "macaw",
    description: "Posicione 6 araras, cruze 3 linhas e marque 3 pontos."
  },
  {
    id: "capuchin",
    speciesId: "capuchin",
    description: "Use 7 macacos, complete os 3 habitats e marque 3 pontos."
  },
  {
    id: "coati",
    speciesId: "coati",
    description: "Encadeie duplas exatas para adicionar quatis da reserva e marcar 3 pontos."
  }
];

const AVAILABLE_SPECIES_IDS = new Set<SpeciesId>(
  SPECIES_CHAPTERS.map((chapter) => chapter.speciesId)
);

function ChapterBadge({ done }: { done: boolean }) {
  return done ? (
    <span className="tutorial-chapter-badge done">
      <Check aria-hidden="true" /> Concluído
    </span>
  ) : (
    <span className="tutorial-chapter-badge play">
      <Play aria-hidden="true" /> Começar
    </span>
  );
}

function ChapterText({
  title,
  description
}: {
  title: string;
  description: ReactNode;
}) {
  return (
    <span className="tutorial-chapter-text">
      <strong>{title}</strong>
      <small>{description}</small>
    </span>
  );
}

export function TutorialChapterSelect({
  completed,
  onBack,
  onStart
}: TutorialChapterSelectProps) {
  return (
    <div className="flow-screen" role="main">
      <div className="landing-bg-orbs" aria-hidden="true">
        <span className="orb orb-1" />
        <span className="orb orb-2" />
        <span className="orb orb-3" />
      </div>

      <header className="flow-header">
        <button type="button" className="flow-back" onClick={onBack} aria-label="Voltar">
          <ChevronLeft aria-hidden="true" />
          <span>Voltar</span>
        </button>
        <div className="landing-logo flow-logo">
          <img className="brand-logo-img brand-logo-img-sm" src="/oikos-logo.webp" alt="Oikos" />
        </div>
        <span className="flow-spacer" aria-hidden="true" />
      </header>

      <div className="flow-body">
        <h2 className="flow-title">Tutoriais</h2>
        <p className="flow-subtitle">Escolha um capítulo. Comece pelo tutorial básico.</p>

        <div className="tutorial-chapters">
          <button
            type="button"
            className={`tutorial-chapter ${completed.initial ? "is-done" : "is-available"}`}
            onClick={() => onStart("initial")}
          >
            <span className="tutorial-chapter-icon">
              <GraduationCap aria-hidden="true" />
            </span>
            <ChapterText
              title="Tutorial básico"
              description="Meeples, cartas, rios, rotação, movimento e pontuação final."
            />
            <ChapterBadge done={completed.initial} />
          </button>

          {SPECIES_CHAPTERS.map((chapter) => {
            const species = speciesDefinitions[chapter.speciesId];
            return (
              <button
                key={chapter.id}
                type="button"
                className={`tutorial-chapter ${completed[chapter.id] ? "is-done" : "is-available"}`}
                style={{ "--species-color": SPECIES_HEX[chapter.speciesId] } as CSSProperties}
                onClick={() => onStart(chapter.id)}
              >
                <span className="tutorial-chapter-icon">
                  <img className="is-portrait" src={encodeURI(species.portraitAsset)} alt="" />
                </span>
                <ChapterText
                  title={species.displayName}
                  description={
                    chapter.richDescription ? (
                      <ResourceText text={chapter.description} />
                    ) : (
                      chapter.description
                    )
                  }
                />
                <ChapterBadge done={completed[chapter.id]} />
              </button>
            );
          })}

          {speciesList
            .filter((species) => !AVAILABLE_SPECIES_IDS.has(species.speciesId))
            .map((species) => (
              <div
                key={species.speciesId}
                className="tutorial-chapter is-locked"
                style={{ "--species-color": SPECIES_HEX[species.speciesId] } as CSSProperties}
                aria-disabled="true"
              >
                <span className="tutorial-chapter-icon">
                  <img className="is-portrait" src={encodeURI(species.portraitAsset)} alt="" />
                </span>
                <ChapterText
                  title={species.displayName}
                  description="Aprenda a jogar com esta espécie."
                />
                <span className="tutorial-chapter-badge locked">
                  <Lock aria-hidden="true" /> Em breve
                </span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
