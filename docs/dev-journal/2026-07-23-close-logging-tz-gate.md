# Log: Close logging for skipped students + explicit student timezone gate

### Prompt
"i should be able to add a close to each student, cause some i cant do it now because i pressed skip for now. also, the student when they sign into the portal need to put in their own timezone now, for those who already have access to the portal, add a soft lock" (plus earlier: "why's my pc heating up" / "remove faka data").

### Issue
1. The student-profile "Set up payment" button (which creates the deal + installments, i.e. the close) rendered only while `payment_state` was NULL. Approving a signup with "skip for now" then setting the Pay chip by hand buried the entrance permanently, leaving students with no deal on record. 2. Yesterday's `students.timezone` auto-sync silently captured the browser zone; founder wants students to explicitly confirm their timezone, including everyone who already has portal access. 3. Demo dataset needed removal; a leftover vite dev server plus external processes were heating the machine.

### What I did
- Profile: fetchPage also checks `deals` (id, limit 1). Button now shows for admin/closer whenever NO deal exists (scholarship excluded), labeled "Log the close · no deal on record" when a payment state was set by hand. Same StudentPaymentSetup dialog (closer/setter/value/PIF-installments) — only the entrance changed.
- Portal: removed the silent timezone auto-sync effect. Added `TimezoneGate` — a full-screen one-time soft lock rendered before graduation/Start Here branches whenever `student.timezone` is NULL: IANA select pre-filled from the browser zone, live "your current time should be h:mm" preview (30s tick), confirm calls the existing `syncStudentTimezone` server fn and unlocks in place. Cleared the 4 auto-synced timezones in prod so existing students confirm on next sign-in.
- Ops: `npm run demo:remove` wiped seed v3 (verified 0 demo rows/users; 22 real students intact); killed the orphaned vite dev server (yesterday's `kill %1` ran in a fresh shell and missed it). Identified the real heat: ivy-content-studio next-server at 111% CPU (hermes' project, left running) + Steam under CrossOver.

### How I did it
hasDeal defaults true so the button never flashes during load. Gate order in the portal: timezone → graduation → Start Here lock → full portal, all after `first` is derived. `timezoneOptions()`/`timeIn` reused from student-local-time. Commit `caa1426`; tsc/46 tests/lint/build green; deploy poll running.

### What was challenging
The em-dash sweep had rewritten the button copy I targeted (edit failed until re-grepped) — reminder that this codebase mutates under me between sessions. Deciding to wipe the 4 auto-synced zones: silent capture vs founder's explicit-confirmation intent — wiped, so the gate applies uniformly.

### Future work
- Founder may want a "change my timezone" control inside the student portal later (currently staff-edit only after confirmation).
- Trustpilot URL for the graduation card still pending.
- Roster "Add student" manual flow also allows skipping payment — same recovery button now covers it.
