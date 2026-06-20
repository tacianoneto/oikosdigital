# Codex Operating Rules

These rules are mandatory for every Codex session in this repository.

## Publish Every Update

Every project update must be published to GitHub.

- Validate the change.
- Create a git commit.
- Push the commit to `origin`.
- Do not call the task complete while changes exist only locally.
- If push fails, report the error and treat the task as still pending.

## Bump Visible Beta Version

While the game is in beta `0.1`, every published update must increment the visible in-game version before commit/push.

- Current visible version lives in `apps/web/src/version.ts`.
- Example: `v0.1.10 beta` -> `v0.1.11 beta`.
- The visible version must change in the game UI so production deploy can be verified.
- If `https://oikosdigital.com.br/` still shows the old version after deploy, treat production as not yet verified.

## Local And Online Parity

Every rule, action, objective, scenario, threat, bot, and endgame flow must work in both local test mode and online multiplayer.

- Local mode may apply rules directly in the browser.
- Online mode must go through the authoritative Socket.IO server.
- New gameplay actions need both local handling and server/socket handling.
