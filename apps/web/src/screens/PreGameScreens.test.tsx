import { isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { PublicRoomState } from "@oikos/shared";
import type { RoomSummary } from "@oikos/shared";
import { CreateRoomScreen } from "./CreateRoomScreen";
import { JoinRoomScreen } from "./JoinRoomScreen";
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

describe("CreateRoomScreen", () => {
  it("shows the public-room hint when no password is set", () => {
    const markup = renderToStaticMarkup(
      <CreateRoomScreen
        name="Taciano"
        createPassword=""
        onNameChange={() => undefined}
        onPasswordChange={() => undefined}
        onBack={() => undefined}
        onSubmit={() => undefined}
      />
    );

    expect(markup).toContain("Criar Sala");
    expect(markup).toContain("aparece na lista de salas abertas");
  });

  it("shows the private-room hint when a password is set", () => {
    const markup = renderToStaticMarkup(
      <CreateRoomScreen
        name="Taciano"
        createPassword="secret"
        onNameChange={() => undefined}
        onPasswordChange={() => undefined}
        onBack={() => undefined}
        onSubmit={() => undefined}
      />
    );

    expect(markup).toContain("só entra quem tiver o código e a senha");
  });

  it("forwards the back action", () => {
    const onBack = vi.fn();
    const elements = collectElements(
      CreateRoomScreen({
        name: "Taciano",
        createPassword: "",
        onNameChange: () => undefined,
        onPasswordChange: () => undefined,
        onBack,
        onSubmit: () => undefined
      })
    );
    const backButton = elements.find(
      (element) => element.type === "button" && String(element.props.className).includes("flow-back")
    );

    (backButton?.props.onClick as () => void)();

    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

describe("JoinRoomScreen", () => {
  const baseProps = {
    name: "Taciano",
    joinCode: "",
    joinPassword: "",
    openRooms: [] as RoomSummary[],
    roomsLoading: false,
    onNameChange: () => undefined,
    onJoinCodeChange: () => undefined,
    onJoinPasswordChange: () => undefined,
    onBack: () => undefined,
    onRefreshRooms: () => undefined,
    onJoinRoom: () => undefined,
    onSpectateRoom: () => undefined,
    onJoinByCode: () => undefined,
    onSpectateByCode: () => undefined
  };

  it("lists open rooms with host and capacity", () => {
    const room = {
      roomId: "ABCDE",
      hostName: "Host One",
      playerCount: 1,
      maxPlayers: 4,
      spectatorCount: 0,
      status: "lobby"
    } as RoomSummary;

    const markup = renderToStaticMarkup(<JoinRoomScreen {...baseProps} openRooms={[room]} />);

    expect(markup).toContain("ABCDE");
    expect(markup).toContain("Host One");
    expect(markup).toContain("1/4");
    expect(markup).toContain("Aguardando");
  });

  it("shows the searching state while loading with no rooms", () => {
    const markup = renderToStaticMarkup(<JoinRoomScreen {...baseProps} roomsLoading />);

    expect(markup).toContain("Procurando salas…");
  });

  it("disables the join button until the code is long enough", () => {
    const markup = renderToStaticMarkup(<JoinRoomScreen {...baseProps} joinCode="AB" />);

    expect(markup).toContain("disabled");
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
