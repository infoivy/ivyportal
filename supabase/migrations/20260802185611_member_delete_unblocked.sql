-- Team-member deletion was impossible (founder 2026-08-02): six attribution
-- FKs blocked auth.admin.deleteUser for anyone who had ever chatted, made a
-- follow-up, expense, alert, or correction. Records must SURVIVE their
-- author: attribution goes NULL on account deletion.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT conname, conrelid::regclass::text AS tbl, a.attname AS col
    FROM pg_constraint
    JOIN unnest(conkey) WITH ORDINALITY AS k(attnum, ord) ON true
    JOIN pg_attribute a ON a.attrelid = conrelid AND a.attnum = k.attnum
    WHERE contype = 'f' AND confrelid = 'auth.users'::regclass
      AND connamespace = 'public'::regnamespace
      AND confdeltype IN ('a', 'r')
      AND (conrelid::regclass::text, a.attname) IN (
        ('business_expenses', 'created_by'),
        ('eod_correction_archive', 'archived_by'),
        ('role_access', 'updated_by'),
        ('set_follow_ups', 'created_by'),
        ('student_alerts', 'created_by'),
        ('team_chat', 'created_by')
      )
  LOOP
    EXECUTE format('ALTER TABLE %s ALTER COLUMN %I DROP NOT NULL', r.tbl, r.col);
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.tbl, r.conname);
    EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES auth.users(id) ON DELETE SET NULL', r.tbl, r.conname, r.col);
  END LOOP;
END $$;
