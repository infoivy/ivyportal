-- Public bucket for knowledge-doc screenshots/assets.
insert into storage.buckets (id, name, public)
values ('doc-assets', 'doc-assets', true)
on conflict (id) do nothing;

-- Public bucket objects are readable via the public URL; writes are
-- admin-only (uploads normally happen via service-role maintenance scripts).
create policy "doc assets admin write" on storage.objects
  for insert with check (bucket_id = 'doc-assets' and public.has_role(auth.uid(), 'admin'));
create policy "doc assets admin update" on storage.objects
  for update using (bucket_id = 'doc-assets' and public.has_role(auth.uid(), 'admin'));
create policy "doc assets admin delete" on storage.objects
  for delete using (bucket_id = 'doc-assets' and public.has_role(auth.uid(), 'admin'));
