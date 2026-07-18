-- Calendly bookings import as unclaimed sets (no owner until a setter claims).
ALTER TABLE public.set_reminders ALTER COLUMN owner_id DROP NOT NULL;
ALTER TABLE public.set_reminders ADD COLUMN IF NOT EXISTS calendly_event_uri text UNIQUE;

-- Claiming: sales staff may take ownership of an unclaimed set.
CREATE POLICY "Sales staff claim unclaimed sets" ON public.set_reminders
  FOR UPDATE TO authenticated
  USING (
    owner_id IS NULL
    AND (
      public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'founder')
      OR public.has_role(auth.uid(), 'setter') OR public.has_role(auth.uid(), 'closer')
    )
  )
  WITH CHECK (owner_id = auth.uid());
