import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type EmailChangeInput = { current_email: string; new_email: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const adminChangeUserEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: EmailChangeInput) => {
    const current_email = (data?.current_email ?? "").trim().toLowerCase();
    const new_email = (data?.new_email ?? "").trim().toLowerCase();
    if (!EMAIL_RE.test(current_email) || !EMAIL_RE.test(new_email)) {
      throw new Error("Both a valid current and new email address are required");
    }
    if (current_email === new_email) throw new Error("The new email is the same as the current one");
    return { current_email, new_email };
  })
  .handler(async ({ data, context }) => {
    // Caller must be an estate admin; RLS-scoped client resolves their estate.
    const { data: isAdmin, error: roleError } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "estate_admin",
    });
    if (roleError) throw new Error(roleError.message);
    if (!isAdmin) throw new Error("Not authorised");

    const { data: adminProfile, error: adminError } = await context.supabase
      .from("profiles")
      .select("estate_id")
      .eq("id", context.userId)
      .maybeSingle();
    if (adminError) throw new Error(adminError.message);
    if (!adminProfile?.estate_id) throw new Error("No estate assigned to your account");

    // Target must belong to the admin's own estate (read through the user-scoped client).
    const { data: target, error: targetError } = await context.supabase
      .from("profiles")
      .select("id, full_name, estate_id")
      .eq("estate_id", adminProfile.estate_id)
      .ilike("email", data.current_email)
      .maybeSingle();
    if (targetError) throw new Error(targetError.message);
    if (!target) throw new Error("No user in your estate with that email address");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(target.id, {
      email: data.new_email,
      email_confirm: true,
    });
    if (authError) throw new Error(authError.message);

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({ email: data.new_email })
      .eq("id", target.id);
    if (profileError) throw new Error(profileError.message);

    await supabaseAdmin.from("audit_logs").insert({
      estate_id: adminProfile.estate_id,
      actor_id: context.userId,
      action: "support.email_changed",
      entity: "profiles",
      entity_id: target.id,
    });

    await supabaseAdmin.from("notifications").insert({
      estate_id: adminProfile.estate_id,
      user_id: target.id,
      title: "Email address updated",
      body: `Your sign-in email was changed to ${data.new_email} by estate management.`,
    });

    return { full_name: target.full_name as string, email: data.new_email };
  });
