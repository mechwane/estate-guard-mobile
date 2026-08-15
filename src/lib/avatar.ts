import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const isAbsolute = (p: string) => /^(https?:|data:|blob:)/.test(p);

export function useAvatarUrl(avatarPath: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(
    avatarPath && isAbsolute(avatarPath) ? avatarPath : null,
  );
  useEffect(() => {
    let cancelled = false;
    if (!avatarPath) {
      setUrl(null);
      return;
    }
    // Some profiles store a full public URL instead of a storage path.
    if (isAbsolute(avatarPath)) {
      setUrl(avatarPath);
      return;
    }
    supabase.storage
      .from("avatars")
      .createSignedUrl(avatarPath, 60 * 60)
      .then(({ data }) => {
        if (!cancelled) setUrl(data?.signedUrl ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [avatarPath]);
  return url;
}


/**
 * Batch variant: signs many avatar paths at once and returns a
 * `path -> signed url` map. Used by grids that show dozens of residents.
 */
export function useAvatarUrls(paths: (string | null | undefined)[]) {
  const key = paths.filter(Boolean).sort().join("|");
  const [map, setMap] = useState<Record<string, string>>({});
  useEffect(() => {
    let cancelled = false;
    const all = key ? key.split("|") : [];
    const absolute = all.filter(isAbsolute);
    const list = all.filter((p) => !isAbsolute(p));
    const base: Record<string, string> = {};
    absolute.forEach((p) => (base[p] = p));
    if (list.length === 0) {
      setMap(base);
      return;
    }
    supabase.storage
      .from("avatars")
      .createSignedUrls(list, 60 * 60)
      .then(({ data }) => {
        if (cancelled || !data) return;
        const next: Record<string, string> = { ...base };
        data.forEach((entry) => {
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


export function initialsFor(name?: string | null) {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}
