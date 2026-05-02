// Session-only unlock store. Once a user watches an ad and unlocks a module,
// it stays unlocked for the rest of THIS app session only. Closing the app
// (full reload) clears the set, forcing another rewarded ad next time.

const unlocked = new Set<string>();

export const isModuleUnlocked = (chapterId: string) => unlocked.has(chapterId);
export const markModuleUnlocked = (chapterId: string) => {
  unlocked.add(chapterId);
};
