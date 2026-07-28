-- Security-advisor sweep 2026-07-28: trigger and maintenance functions are
-- not part of the client API surface, but default PUBLIC EXECUTE exposed
-- them via /rest/v1/rpc to anon and authenticated. Revoke both. Trigger
-- execution is unaffected (EXECUTE is checked at trigger creation, and the
-- triggers already exist); verify_security_schema is called with the
-- service role, which keeps its own grant. has_role, pending_signups, and
-- student_toggle_action_item stay callable by signed-in users on purpose.
REVOKE EXECUTE ON FUNCTION public.deals_prevent_reassignment() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_first_close_milestone() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_placement_to_student() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.write_audit_log() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.verify_security_schema() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.link_student_record_by_email() FROM PUBLIC, anon, authenticated;
