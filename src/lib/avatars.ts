import { supabase } from "@/integrations/supabase/client";

// Cache signed URLs briefly to avoid re-signing on every render.
const urlCache = new Map<string, { url: string; exp: number }>();
const TTL_MS = 55 * 60 * 1000; // 55 min

export async function signAvatar(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  const hit = urlCache.get(path);
  if (hit && hit.exp > Date.now()) return hit.url;
  const { data, error } = await supabase.storage.from("avatars").createSignedUrl(path, 60 * 60);
  if (error || !data) return null;
  urlCache.set(path, { url: data.signedUrl, exp: Date.now() + TTL_MS });
  return data.signedUrl;
}

export async function signAvatars(paths: (string | null | undefined)[]): Promise<Record<string, string>> {
  const unique = Array.from(new Set(paths.filter(Boolean))) as string[];
  const out: Record<string, string> = {};
  await Promise.all(unique.map(async p => {
    const u = await signAvatar(p);
    if (u) out[p] = u;
  }));
  return out;
}

export async function uploadAvatar(userId: string, file: File): Promise<string> {
  const ext = (file.name.split(".").pop() ?? "png").toLowerCase();
  const path = `${userId}/avatar-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("avatars").upload(path, file, {
    upsert: true, contentType: file.type,
  });
  if (error) throw new Error(error.message);
  return path;
}
