// Release rule: every published update must bump this visible beta version
// before commit/push. Example: v0.1.11 beta -> v0.1.12 beta.
// A task is only done after validation, git commit, and git push to origin.
export const GAME_VERSION = "v0.1.11 beta";
