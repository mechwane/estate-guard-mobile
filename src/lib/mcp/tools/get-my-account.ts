import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_my_account",
  title: "Get my account",
  description:
    "Return the signed-in Estate Guard user's profile, role and estate (name, code, status).",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const userId = ctx.getUserId();

    const [{ data: profile, error: profileError }, { data: roles }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id,full_name,phone,unit,approved,estate_id,verification_status")
        .eq("id", userId)
        .maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);

    if (profileError) {
      return { content: [{ type: "text", text: profileError.message }], isError: true };
    }

    let estate: unknown = null;
    if (profile?.estate_id) {
      const { data } = await supabase
        .from("estates")
        .select("id,name,code,status")
        .eq("id", profile.estate_id)
        .maybeSingle();
      estate = data ?? null;
    }

    const account = {
      email: ctx.getUserEmail() ?? null,
      roles: (roles ?? []).map((r) => r.role),
      profile: profile ?? null,
      estate,
    };

    return {
      content: [{ type: "text", text: JSON.stringify(account, null, 2) }],
      structuredContent: { account },
    };
  },
});
