# Log: WhatsApp number joins the student details soft lock

### Prompt
"have all students put in their whatsapp number, lock it until theyve done that"

### Issue
students.whatsapp existed but was staff-entered and mostly empty; the team's loom feedback and check-ins run on WhatsApp.

### What I did
Commit `fb997bb`. Extended the timezone soft lock into a DetailsGate that asks only for what's missing: new students see timezone + WhatsApp, students who already confirmed their timezone see just the WhatsApp field on their next sign-in. New `saveStudentWhatsapp` server fn (students can't update their own row under RLS): strips separators, enforces `+` country code E.164-ish (8-15 digits), writes `students.whatsapp` — exactly where the roster/profile already display it. No schema change needed.

### How I did it
Client permits pretty-typed numbers ("+44 7700 900123"); the server stores the cleaned form. Gate ordering unchanged: details → graduation → Start Here lock → walkthrough soft-lock → full portal.

### Future work
- Students can't edit their WhatsApp later (staff can, via AddStudentModal fields); a Profile card like the timezone one is trivial if asked.

### Addendum (same day)
Commit `f992547`: profile "Next action" input replaced with a NextActionsComposer · each add is a real student_action_item (text + shadcn calendar due date, multi-add, inline open-items list with humanDue + done checkbox); students.next_action mirrors the latest entry for the roster column. Also investigated founder's "student requests aren't coming in": pipeline healthy — the two 48h signups (Abdullaah Medjedovic, Ibrahim Rashid) auto-linked to staff-created student rows by email match and were granted the student role instantly, so they correctly never appear in Requests (it lists only role-less accounts). Confirmed the already-unlocked-without-details case needs no new work: DetailsGate keys on missing timezone/whatsapp regardless of unlock state.
