import { auth, defineMcp } from "@lovable.dev/mcp-js";
import getMyAccount from "./tools/get-my-account";
import listMyBills from "./tools/list-my-bills";
import listGuestInvites from "./tools/list-guest-invites";
import createGuestInvite from "./tools/create-guest-invite";
import listMyNotifications from "./tools/list-my-notifications";

// The OAuth issuer must be the direct Supabase host; the project ref is the only
// value that survives publish unchanged.
const projectRef = import.meta.env['VITE_SUPABASE_PROJECT_ID'] ?? "project-ref-unset";

export default defineMcp({
  name: "estate-guard-pro",
  title: "Estate Guard Pro",
  version: "0.1.0",
  instructions:
    "Tools for Estate Guard Pro, an estate access and community management app. Callers act as the signed-in user: read their account and estate, list their bills and notifications, list guest invites, and create a visitor gate code.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [getMyAccount, listMyBills, listGuestInvites, createGuestInvite, listMyNotifications],
});
