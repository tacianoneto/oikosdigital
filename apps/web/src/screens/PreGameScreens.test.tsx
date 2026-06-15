import { isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { PublicRoomState } from "@oikos/shared";
import { LobbyScreen } from "./LobbyScreen";
import { LocalSetupScreen } from "./LocalSetupScreen";
import { MainMenuScreen } from "./MainMenuScreen";

type TestElement = ReactElement<Record<string, unknown>>;

function collectElements(node: ReactNode): TestElement[] {
  if (Array.isArray(node)) {
    return node.flatMap(collectElements);
  }
  if (!isValidElement(node)) return [];

  const element = node as TestElement;
  return [element, ...collectElements(element.props.children as ReactNode)];
}

describe("MainMenuScreen", () => {
  it("renders menu and forwards navigation", () => {
    const onNavigate = vi.fn();
    const elements = collectElements(
      MainMenuScreen({
        name: "Taciano",
        onNameChange: () => undefined,
        onNavigate,
        onOpenSettings: () => undefined
      })
    );
    const localButton = elements.find(
      (element) =>
        element.type === "button" &&
        String(element.props.className).includes("forest-btn") &&
        renderToStaticMarkup(element).includes("Teste Local")
    );

    (localButton?.props.onClick as () => void)();

    expect(onNavigate).toHaveBeenCalledWith("local");
  });
});

describe("LocalSetupScreen", () => {
  it("keeps start disabled until two species are selected", () => {
    const markup = renderToStaticMarkup(
      <LocalSetupScreen
        speciesIds={["jaguar"]}
        botSpeciesIds={[]}
        botTurnDelayMs={2500}
        enabledMiniExpansions={[]}
        scenarioCount={1}
        selectedScenarioIds={[]}
        formatBotDelay={() => "2.5s"}
        onBack={() => undefined}
        onToggleSpecies={() => undefined}
        onToggleBot={() => undefined}
        onToggleMiniExpansion={() => undefined}
        onToggleScenario={() => undefined}
        onAdjustBotSpeed={() => undefined}
        onStart={() => undefined}
      />
    );

    expect(markup).toContain("Iniciar Partida (1 espécies)");
    expect(markup).toContain("Mínimo 2 espécies para iniciar.");
    expect(markup).toContain("disabled");
  });
});

describe("LobbyScreen", () => {
  it("renders room identity and player state", () => {
    const room = {
      roomId: "ABCDE",
      hostPlayerId: "p1",
      status: "lobby",
      spectatorCount: 0,
      players: [
        {
          playerId: "p1",
          name: "Taciano",
          speciesId: "jaguar",
          ready: true,
          connected: true,
          isBot: false
        }
      ]
    } as PublicRoomState;

    const markup = renderToStaticMarkup(
      <LobbyScreen
        room={room}
        playerId="p1"
        controlledPlayerId="p1"
        currentPlayer={room.players[0]}
        selectedSpecies="jaguar"
        isLocalRoom={false}
        isSpectator={false}
        isHost
        readyPlayerCount={1}
        enabledMiniExpansions={[]}
        scenarioSelectionMode="vote"
        scenarioCount={1}
        hostSelectedScenarioIds={[]}
        turnTimerMs={null}
        botTurnDelayMs={2500}
        roomHasBots={false}
        needsHostScenarioSelection={false}
        formatBotDelay={() => "2.5s"}
        onExit={() => undefined}
        onCopyCode={() => undefined}
        onRenameSelf={() => undefined}
        onKickPlayer={() => undefined}
        onToggleMiniExpansion={() => undefined}
        onSetScenarioMode={() => undefined}
        onToggleHostScenario={() => undefined}
        onToggleTurnTimer={() => undefined}
        onAdjustTurnTimer={() => undefined}
        onRemoveBots={() => undefined}
        onAdjustBotSpeed={() => undefined}
        onSelectSpecies={() => undefined}
        onToggleBotSpecies={() => undefined}
        onReady={() => undefined}
        onStart={() => undefined}
      />
    );

    expect(markup).toContain("ABCDE");
    expect(markup).toContain("Taciano");
    expect(markup).toContain("Pronto");
    expect(markup).toContain("Iniciar Partida");
  });
});
