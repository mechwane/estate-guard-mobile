import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "resident" | "guard" | "estate_admin" | "super_admin";

export interface SessionInfo {
  userId: string | null;
  email: string | null;
  role: AppRole | null;
  profile: {
    id: string;
    full_name: string;
    phone: string | null;
    estate_id: string | null;
    unit: string | null;
    approved: boolean;
  } | null;
  estate: { id: string; name: string; code: string; status: string } | null;
}

const roleRank: Record<AppRole, number> = {
  super_admin: 4,
  estate_admin: 3,
  guard: 2,
  resident: 1,
};

export async function fetchSessionInfo(): Promise<SessionInfo> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return { userId: null, email: null, role: null, profile: null, estate: null };

  const [{ data: roles }, { data: profile }] = await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", user.id),
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
  ]);

  const role: AppRole | null =
    (roles ?? []).map((r) => r.role as AppRole).sort((a, b) => roleRank[b] - roleRank[a])[0] ?? null;

  let estate: SessionInfo["estate"] = null;
  if (profile?.estate_id) {
    const { data: e } = await supabase
      .from("estates")
      .select("id,name,code,status")
      .eq("id", profile.estate_id)
      .maybeSingle();
    estate = e as SessionInfo["estate"];
  }

  return {
    userId: user.id,
    email: user.email ?? null,
    role,
    profile: profile as SessionInfo["profile"],
    estate,
  };
}

export function useSession() {
  return useQuery({
    queryKey: ["session"],
    queryFn: fetchSessionInfo,
    staleTime: 30_000,
  });
}

export function roleHome(role: AppRole | null): string {
  switch (role) {
    case "super_admin": return "/app/super";
    case "estate_admin": return "/app/admin";
    case "guard": return "/app/guard";
    case "resident": return "/app/resident";
    default: return "/auth/sign-in";
  }
}
