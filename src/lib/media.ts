import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const MEDIA_BUCKET = "estate-media";

const isAbsolute = (v: string) => /^(https?:|data:|blob:)/i.test(v);

/** Uploads a picked file into the shared media bucket and returns its storage path. */
export async function uploadMedia(file: File, folder = "uploads") {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new Error("You must be signed in to upload files.");
  const ext = (file.name.split(".").pop() ?? "bin").toLowerCase().slice(0, 8);
  const path = `${uid}/${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });
  if (error) throw error;
  return path;
}

/** Resolves a stored value (storage path OR legacy absolute URL) to a viewable URL. */
export function useMediaUrl(value: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(value && isAbsolute(value) ? value : null);
  useEffect(() => {
    let cancelled = false;
    if (!value) {
      setUrl(null);
      return;
    }
    if (isAbsolute(value)) {
      setUrl(value);
      return;
    }
    supabase.storage
      .from(MEDIA_BUCKET)
      .createSignedUrl(value, 60 * 60)
      .then(({ data }) => {
        if (!cancelled) setUrl(data?.signedUrl ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [value]);
  return url;
}

/** Batch variant for grids: returns a `value -> viewable url` map. */
export function useMediaUrls(values: (string | null | undefined)[]) {
  const key = values.filter(Boolean).sort().join("|");
  const [map, setMap] = useState<Record<string, string>>({});
  useEffect(() => {
    let cancelled = false;
    const list = key ? key.split("|") : [];
    const next: Record<string, string> = {};
    for (const v of list) if (isAbsolute(v)) next[v] = v;
    const paths = list.filter((v) => !isAbsolute(v));
    if (paths.length === 0) {
      setMap(next);
      return;
    }
    supabase.storage
      .from(MEDIA_BUCKET)
      .createSignedUrls(paths, 60 * 60)
      .then(({ data }) => {
        if (cancelled) return;
        (data ?? []).forEach((entry) => {
          if (entry.path && entry.signedUrl) next[entry.path] = entry.signedUrl;
        });
        setMap(next);
      });
    return () => {
      cancelled = true;
    };
  }, [key]);
  return map;
}
