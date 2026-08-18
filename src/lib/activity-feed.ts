// Plain-language activity feed for the admin dashboard.
//
// Raw audit rows read like machine events ("device.takeover", "access.revoked"),
// which other estate admins cannot interpret. This module turns gate traffic,
// payments and audit rows into human sentences such as
// "New Check In — Isaac Yusuf's guest just checked in · 172914".

import { supabase } from "@/integrations/supabase/client";

export type FeedItem = {
  id: string;
  title: string;
  description: string;
  code?: string | null;
  at: string;
  tone: "in" | "out" | "money" | "info";
};

const AUDIT_TITLES: Record<string, string> = {
  "device.takeover": "New Device Sign-in",
  "device.claimed": "New Device Sign-in",
  "device.released": "Device Signed Out",
  "device.registered": "New Gate Device",
  "device.status_changed": "Gate Device Updated",
  "access.granted": "Access Approved",
  "access.revoked": "Access Revoked",
  "resident.approved": "Resident Approved",
  "resident.revoked": "Resident Access Revoked",
  "verification.approved": "Verification Approved",
  "verification.rejected": "Verification Rejected",
  "verification.submitted": "New Verification Request",
  "verification.pending": "New Verification Request",
  "biometric.updated": "Biometric Access Updated",
  "post.created": "New Announcement",
  "post.edited": "Announcement Edited",
  "comment.posted": "New Comment",
  "meeting.created": "New Meeting",
  "broadcast.sent": "Broadcast Sent",
  "bill.paid": "New Payment",
  "bill.paid.offline": "New Payment (Offline)",
  "bill.created": "New Bill",
  "collection.created": "New Collection",
  "issue.created": "New Incident Report",
  "issue.updated": "Incident Updated",
  "pass.issued": "New Pass Issued",
  "pass.used": "Pass Used at Gate",
  "guest.check_in": "New Check In",
  "guest.check_out": "New Check Out",
  "shop_order.created": "New Order",
  "feature_flag.set": "Estate Setting Changed",
};

export function friendlyAction(action: string) {
  const known = AUDIT_TITLES[action];
  if (known) return known;
  return action
    .replace(/[._]/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const firstName = (name: string) => name.split(/\s+/)[0] ?? name;

export async function fetchEstateActivity(estateId: string, limit = 25): Promise<FeedItem[]> {
  const [guests, pays, logs, people] = await Promise.all([
    supabase
      .from("guest_invites")
      .select("id,resident_id,guest_name,code,checked_in_at,checked_out_at,created_at")
      .eq("estate_id", estateId)
      .order("updated_at", { ascending: false })
      .limit(40),
    supabase
      .from("payments")
      .select("id,resident_id,amount,method,paid_at")
      .eq("estate_id", estateId)
      .order("paid_at", { ascending: false })
      .limit(15),
    supabase
      .from("audit_logs")
      .select("id,action,entity,actor_id,metadata,created_at")
      .eq("estate_id", estateId)
      .order("created_at", { ascending: false })
      .limit(25),
    supabase.from("profiles").select("id,full_name").eq("estate_id", estateId),
  ]);

  const nameOf = (id: string | null | undefined) =>
    (people.data ?? []).find((p) => p.id === id)?.full_name ?? "A resident";

  const items: FeedItem[] = [];

  for (const g of guests.data ?? []) {
    if (g.checked_out_at) {
      items.push({
        id: `${g.id}-out`,
        title: "New Check Out",
        description: `${nameOf(g.resident_id)}'s guest just checked out`,
        code: g.code,
        at: g.checked_out_at,
        tone: "out",
      });
    }
    if (g.checked_in_at) {
      items.push({
        id: `${g.id}-in`,
        title: "New Check In",
        description: `${nameOf(g.resident_id)}'s guest just checked in`,
        code: g.code,
        at: g.checked_in_at,
        tone: "in",
      });
    }
  }

  for (const p of pays.data ?? []) {
    items.push({
      id: `pay-${p.id}`,
      title: "New Payment",
      description: `${nameOf(p.resident_id)} paid ₦${Number(p.amount).toLocaleString()} via ${p.method}`,
      at: p.paid_at,
      tone: "money",
    });
  }

  for (const l of logs.data ?? []) {
    // Gate traffic and payments are already covered by the richer rows above.
    if (/^(guest\.|bill\.paid|pass\.)/.test(l.action)) continue;
    const meta = (l.metadata ?? {}) as Record<string, unknown>;
    const who = typeof meta['full_name'] === "string" ? meta['full_name'] : nameOf(l.actor_id);
    const extra =
      typeof meta['reason'] === "string" && meta['reason']
        ? ` — ${meta['reason']}`
        : typeof meta['title'] === "string" && meta['title']
          ? ` — ${meta['title']}`
          : "";
    items.push({
      id: `log-${l.id}`,
      title: friendlyAction(l.action),
      description: `${firstName(who)} ${l.action.includes("revoke") ? "lost" : "updated"} ${l.entity ?? "a record"}${extra}`.replace(
        "updated a record",
        "made a change",
      ),
      at: l.created_at,
      tone: "info",
    });
  }

  return items.sort((a, b) => +new Date(b.at) - +new Date(a.at)).slice(0, limit);
}
