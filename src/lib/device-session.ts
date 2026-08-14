// Single-device sign-in. Each browser gets a stable device id kept in
// localStorage; the backend stores one active device per user, so signing in
// somewhere else is blocked until the previous device logs out (or the user
// deliberately takes the session over).

import { supabase } from "@/integrations/supabase/client";

const KEY = "eg.device-id";

export function getDeviceId(): string {
  if (typeof window === "undefined") return "";
  let id = window.localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    window.localStorage.setItem(KEY, id);
  }
  return id;
}

export function getDeviceLabel(): string {
  if (typeof navigator === "undefined") return "Unknown device";
  const ua = navigator.userAgent;
  const os = /Android/i.test(ua)
    ? "Android"
    : /iPhone|iPad|iPod/i.test(ua)
      ? "iOS"
      : /Macintosh/i.test(ua)
        ? "macOS"
        : /Windows/i.test(ua)
          ? "Windows"
          : /Linux/i.test(ua)
            ? "Linux"
            : "Device";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Chrome\//.test(ua)
      ? "Chrome"
      : /Safari\//.test(ua)
        ? "Safari"
        : /Firefox\//.test(ua)
          ? "Firefox"
          : "Browser";
  return `${os} · ${browser}`;
}

export type DeviceClaim =
  | { ok: true }
  | { ok: false; reason: string; deviceLabel?: string | null; lastSeenAt?: string | null };

export async function claimDeviceSession(force = false): Promise<DeviceClaim> {
  const deviceId = getDeviceId();
  if (!deviceId) return { ok: true };
  const { data, error } = await supabase.rpc("claim_device_session", {
    _device_id: deviceId,
    _device_label: getDeviceLabel(),
    _user_agent: typeof navigator === "undefined" ? null : navigator.userAgent.slice(0, 400),
    _force: force,
  } as never);
  // Never lock a user out because of a transient network/RPC failure.
  if (error) return { ok: true };
  const res = (data ?? {}) as {
    ok?: boolean;
    reason?: string;
    device_label?: string | null;
    last_seen_at?: string | null;
  };
  if (res.ok) return { ok: true };
  return {
    ok: false,
    reason: res.reason ?? "other_device",
    deviceLabel: res.device_label ?? null,
    lastSeenAt: res.last_seen_at ?? null,
  };
}

export async function releaseDeviceSession(): Promise<void> {
  const deviceId = getDeviceId();
  if (!deviceId) return;
  await supabase.rpc("release_device_session", { _device_id: deviceId } as never);
}
