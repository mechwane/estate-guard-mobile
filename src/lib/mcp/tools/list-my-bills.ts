import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_my_bills",
  title: "List my bills",
  description:
    "List the signed-in resident's estate bills (title, amount, due date, status), newest first.",
  inputSchema: {
    status: z
      .string()
      .optional()
      .describe("Optional status filter, e.g. pending, paid or waived."),
    limit: z.number().int().optional().describe("Maximum rows to return (default 20, max 100)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const take = Math.min(Math.max(limit ?? 20, 1), 100);

    let query = supabase
      .from("bills")
      .select("id,title,description,amount,due_date,status,created_at")
      .order("created_at", { ascending: false })
      .limit(take);
    if (status) query = query.eq("status", status);

    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { bills: data ?? [] },
    };
  },
});
