// Tiny event bus so the mobile bottom-nav (rendered in the layout) can
// switch the student-portal tab (rendered inside the route).
type Listener = (tab: string) => void;
const listeners = new Set<Listener>();
let currentTab = "home";

/**
 * Redesign 2026-08-11: six tabs became three (home / progress / board) plus
 * the pre-unlock "start". Old keys can still arrive from persisted state,
 * the sidebar, or stale bookmailed links — map them instead of breaking.
 */
export function normalizeStudentTab(tab: string): string {
  switch (tab) {
    case "eod":
    case "actions":
      return "home";
    case "coaching":
    case "milestones":
      return "progress";
    case "leaderboard":
      return "board";
    default:
      return tab === "home" || tab === "progress" || tab === "board" || tab === "start" ? tab : "home";
  }
}

export function setStudentPortalTab(tab: string) {
  currentTab = normalizeStudentTab(tab);
  listeners.forEach(l => l(currentTab));
}
export function getStudentPortalTab() { return currentTab; }
export function onStudentPortalTab(fn: Listener) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
