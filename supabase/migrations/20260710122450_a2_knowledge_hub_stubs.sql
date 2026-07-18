-- A2: Seed missing Knowledge Hub docs as stubs
-- These docs were lost during a migration. Inserting with placeholder content so the
-- links in the sidebar/checklist don't 404. Admins can paste real content via the edit page.

INSERT INTO public.docs (title, slug, category, content, role_visibility, sort_order, pinned)
VALUES
  (
    'GA Roadmap',
    'ga-roadmap',
    'setting',
    E'> ⚠️ **Content missing** — paste the document body here.\n> Admin: go to Knowledge Hub → this doc → Edit.\n\n## GA Roadmap\n\n_Content to be added._',
    ARRAY['setter','closer','admin'],
    10,
    false
  ),
  (
    'Appointment Setting — Conversational Flexibility',
    'appointment-setting-conversational-flexibility',
    'setting',
    E'> ⚠️ **Content missing** — paste the document body here.\n> Admin: go to Knowledge Hub → this doc → Edit.\n\n## Appointment Setting — Conversational Flexibility\n\n_Content to be added._',
    ARRAY['setter','closer','admin'],
    20,
    false
  ),
  (
    'Objection Handling — Part 1',
    'objection-handling-part-1',
    'setting',
    E'> ⚠️ **Content missing** — paste the document body here.\n> Admin: go to Knowledge Hub → this doc → Edit.\n\n## Objection Handling — Part 1\n\n_Content to be added._',
    ARRAY['setter','closer','admin'],
    30,
    false
  ),
  (
    'Objection Handling — Part 2',
    'objection-handling-part-2',
    'setting',
    E'> ⚠️ **Content missing** — paste the document body here.\n> Admin: go to Knowledge Hub → this doc → Edit.\n\n## Objection Handling — Part 2\n\n_Content to be added._',
    ARRAY['setter','closer','admin'],
    40,
    false
  ),
  (
    'Founder Hub — Weekly Content SOP',
    'founder-hub-weekly-content-sop',
    'content',
    E'> ⚠️ **Content missing** — paste the document body here.\n> Admin: go to Knowledge Hub → this doc → Edit.\n\n## Weekly Content SOP\n\n_Content to be added._',
    ARRAY['founder','admin'],
    50,
    false
  ),
  (
    'Founder Hub — Story Sequences SOP',
    'founder-hub-story-sequences-sop',
    'content',
    E'> ⚠️ **Content missing** — paste the document body here.\n> Admin: go to Knowledge Hub → this doc → Edit.\n\n## Story Sequences SOP\n\n_Content to be added._',
    ARRAY['founder','admin'],
    60,
    false
  )
ON CONFLICT (slug) DO NOTHING;
