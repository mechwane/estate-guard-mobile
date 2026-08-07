import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_my_notifications",
  title: "List my notifications",
  description: "List the signed-in user's Estate Guard notifications, newest first.",
  inputSchema: {
    unread_only: z.boolean().optional().describe("Only return notifications not yet read."),
    limit: z.number().int().optional().describe("Maximum rows to return (default 20, max 100)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ unread_only, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const take = Math.min(Math.max(limit ?? 20, 1), 100);

    let query = supabase
      .from("notifications")
      .select("id,title,body,link_to,read_at,created_at")
      .order("created_at", { ascending: false })
      .limit(take);
    if (unread_only) query = query.is("read_at", null);

    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { notifications: data ?? [] },
    };
  },
});
