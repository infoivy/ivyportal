# Log: Student Start Here opened on step 3; onboarding-form step removed

### Prompt
Founder: "the onboarding for students in the current portal is messed up, portal.ivysalesacademy, it goes to step 3 immediately, remove the onboarding form option for now and fix it".

### Issue
`StartHereGuide` (src/routes/_authenticated.student-portal.tsx) featured the first step carrying an `embedUrl` — the offer-board Loom, step 3 — as a hero at the top for every student, labelled "Step 03 of 05 · Watch in full", before steps 1–2 were done. New students read that as being dropped on step 3. Separately the founder wants the Typeform "Fill out your onboarding form" step gone for now.

### What I did
- `src/lib/student-guide-steps.ts`: removed the `typeform` step; `START_HERE_REQUIRED_KEYS` derives from the list so completion no longer requires it. Existing `student_guide_steps` rows keyed `typeform` are left alone (they neither count nor render).
- `src/routes/_authenticated.student-portal.tsx`: the hero is featured only when the student is ON the video step (`i === nextIdx`) or has done it; the "Featured above" note only on that row; "Five steps…" copy (intro + guide heading) derived from the step count.

### How I did it
Branch `fix/student-onboarding` off `origin/main` (local `main` carried three unpushed Bun-splash commits, reset to origin after the merge). `npx tsc --noEmit` clean, `npm test` green (node --test). PR #10 merged to main; Vercel git deploy of project `infopath/ivy` verified serving the merge commit.

### What was challenging
Nothing structural: the server-side `completeStudentOnboarding` re-verifies `START_HERE_REQUIRED_KEYS`, so dropping the step from the list is the whole change on both sides.

### Future work
- The Typeform step can return by re-adding the entry; consider making the list DB-driven (onboarding_templates already exists) so the founder can toggle steps without a deploy.
- Staff badges show "n/4" now; if any dashboard hardcodes 5, it will disagree (none found by grep).
