import { useEffect, useState, type Dispatch, type SetStateAction } from "react";

export interface LobbyForm {
  name: string;
  setName: Dispatch<SetStateAction<string>>;
  joinCode: string;
  setJoinCode: Dispatch<SetStateAction<string>>;
  joinPassword: string;
  setJoinPassword: Dispatch<SetStateAction<string>>;
  createPassword: string;
  setCreatePassword: Dispatch<SetStateAction<string>>;
  isSpectator: boolean;
  setIsSpectator: Dispatch<SetStateAction<boolean>>;
}

// Holds the lobby/landing form inputs: display name, join code, the create and
// join passwords and the spectator flag. The display name seeds from the
// authenticated player's default name and, whenever that default changes, only
// replaces the still-untouched placeholder ("Jogador") so a name the player
// typed is never clobbered. The authoritative online room state is NOT here; it
// stays in OikosApp because it drives the whole multiplayer view.
export function useLobbyForm(defaultPlayerName: string): LobbyForm {
  const [name, setName] = useState(defaultPlayerName);
  const [joinCode, setJoinCode] = useState("");
  const [joinPassword, setJoinPassword] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [isSpectator, setIsSpectator] = useState(false);

  useEffect(() => {
    setName((current) => (current === "Jogador" ? defaultPlayerName : current));
  }, [defaultPlayerName]);

  return {
    name,
    setName,
    joinCode,
    setJoinCode,
    joinPassword,
    setJoinPassword,
    createPassword,
    setCreatePassword,
    isSpectator,
    setIsSpectator
  };
}
