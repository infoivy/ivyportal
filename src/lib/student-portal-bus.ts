// Tiny event bus so the mobile bottom-nav (rendered in the layout) can
// switch the student-portal tab (rendered inside the route).
type Listener = (tab: string) => void;
const listeners = new Set<Listener>();
let currentTab = "eod";

export function setStudentPortalTab(tab: string) {
  currentTab = tab;
  listeners.forEach(l => l(tab));
}
export function getStudentPortalTab() { return currentTab; }
export function onStudentPortalTab(fn: Listener) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
