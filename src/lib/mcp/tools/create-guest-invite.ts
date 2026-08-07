import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

function randomCode() {
  let code = "";
  for (let i = 0; i < 6; i += 1) code += Math.floor(Math.random() * 10).toString();
  return code;
}

export default defineTool({
  name: "create_guest_invite",
  title: "Create guest invite",
  description:
    "Create a gate access code for a visitor of the signed-in resident. Returns the invite code.",
  inputSchema: {
    guest_name: z.string().trim().describe("Visitor's full name."),
    visit_time: z
      .string()
      .optional()
      .describe("ISO timestamp of the expected visit. Defaults to now."),
    valid_hours: z
      .number()
      .int()
      .optional()
      .describe("How many hours the code stays valid from the visit time (default 24)."),
    num_guests: z.number().int().optional().describe("Number of visitors (default 1)."),
    phone: z.string().optional().describe("Visitor phone number."),
    purpose: z.string().optional().describe("Reason for the visit."),
    vehicle_number: z.string().optional().describe("Visitor vehicle plate number."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const name = input.guest_name.trim();
    if (!name) {
      return { content: [{ type: "text", text: "guest_name is required" }], isError: true };
    }

    const supabase = supabaseForUser(ctx);
    const userId = ctx.getUserId();

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("estate_id,approved")
      .eq("id", userId)
      .maybeSingle();
    if (profileError) {
      return { content: [{ type: "text", text: profileError.message }], isError: true };
    }
    if (!profile?.estate_id) {
      return {
        content: [{ type: "text", text: "Your account is not linked to an estate yet." }],
        isError: true,
      };
    }

    const visit = input.visit_time ? new Date(input.visit_time) : new Date();
    if (Number.isNaN(visit.getTime())) {
      return { content: [{ type: "text", text: "visit_time is not a valid date" }], isError: true };
    }
    const hours = Math.min(Math.max(input.valid_hours ?? 24, 1), 24 * 30);
    const expires = new Date(visit.getTime() + hours * 60 * 60 * 1000);

    let lastError = "Could not create invite";
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const { data, error } = await supabase
        .from("guest_invites")
        .insert({
          estate_id: profile.estate_id,
          resident_id: userId,
          guest_name: name,
          phone: input.phone?.trim() || null,
          purpose: input.purpose?.trim() || null,
          visit_time: visit.toISOString(),
          expires_at: expires.toISOString(),
          num_guests: Math.min(Math.max(input.num_guests ?? 1, 1), 50),
          vehicle_number: input.vehicle_number?.trim() || null,
          code: randomCode(),
        })
        .select("id,code,guest_name,visit_time,expires_at,num_guests,status")
        .single();

      if (!error && data) {
        return {
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
          structuredContent: { invite: data },
        };
      }
      lastError = error?.message ?? lastError;
    }

    return { content: [{ type: "text", text: lastError }], isError: true };
  },
});
