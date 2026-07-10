ALTER TYPE public.content_status ADD VALUE IF NOT EXISTS 'approved' AFTER 'scripted';
ALTER TYPE public.content_status ADD VALUE IF NOT EXISTS 'recorded' AFTER 'approved';
ALTER TYPE public.content_status ADD VALUE IF NOT EXISTS 'scheduled' AFTER 'edited';
