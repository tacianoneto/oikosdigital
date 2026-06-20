// Release rule: every published update must bump this visible beta version
// before commit/push. Example: v0.1.8 beta -> v0.1.9 beta.
// A task is only done after validation, git commit, and git push to origin.
export const GAME_VERSION = "v0.1.8 beta";
export const GAME_VERSION_WITH_DOT = "v0.1.8 · beta";
