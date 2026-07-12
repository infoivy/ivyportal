-- Co-founders (Faizan, Abu Bilal) get Finance without founder-only surfaces.
alter type public.app_role add value if not exists 'cofounder';
