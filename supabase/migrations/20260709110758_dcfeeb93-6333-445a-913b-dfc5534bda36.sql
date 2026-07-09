-- Performance indexes for filter/join columns
CREATE INDEX IF NOT EXISTS idx_students_status ON public.students (status);
CREATE INDEX IF NOT EXISTS idx_students_phase ON public.students (phase);
CREATE INDEX IF NOT EXISTS idx_students_coach ON public.students (coach_id);

CREATE INDEX IF NOT EXISTS idx_eods_report_date_desc ON public.eods (report_date DESC);

CREATE INDEX IF NOT EXISTS idx_student_eods_report_date_desc ON public.student_eods (report_date DESC);

CREATE INDEX IF NOT EXISTS idx_student_calls_student ON public.student_calls (student_id);
CREATE INDEX IF NOT EXISTS idx_student_calls_coach ON public.student_calls (coach_id);
CREATE INDEX IF NOT EXISTS idx_student_calls_next_call ON public.student_calls (next_call_date) WHERE next_call_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_student_calls_status_date ON public.student_calls (status, call_date DESC);

CREATE INDEX IF NOT EXISTS idx_deals_student ON public.deals (student_id);

CREATE INDEX IF NOT EXISTS idx_csm_notes_student ON public.csm_student_notes (student_id);
CREATE INDEX IF NOT EXISTS idx_csm_notes_user ON public.csm_student_notes (user_id);

CREATE INDEX IF NOT EXISTS idx_installments_student ON public.installments (student_id);
CREATE INDEX IF NOT EXISTS idx_installments_coach ON public.installments (coach_id);
CREATE INDEX IF NOT EXISTS idx_installments_closer ON public.installments (closer_id);

CREATE INDEX IF NOT EXISTS idx_ig_dashboards_user ON public.ig_dashboards (user_id);
CREATE INDEX IF NOT EXISTS idx_ig_connections_user_status ON public.ig_connections (user_id, status);

CREATE INDEX IF NOT EXISTS idx_docs_pinned_sort ON public.docs (pinned DESC, sort_order);