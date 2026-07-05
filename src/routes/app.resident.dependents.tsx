import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { Card, EmptyState } from "@/components/ui-kit";
import { FadeIn, Stagger, StaggerItem } from "@/components/motion-kit";
import { Users, Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/resident/dependents")({
  component: Dependents,
});

function Dependents() {
  const { data: session } = useSession();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ full_name: "", relationship: "", phone: "", age: "" });

  const list = useQuery({
    queryKey: ["dependents", session?.userId],
    enabled: !!session?.userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dependents")
        .select("*")
        .eq("resident_id", session!.userId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      if (!form.full_name.trim()) throw new Error("Name required");
      const { error } = await supabase.from("dependents").insert({
        resident_id: session!.userId!,
        estate_id: session!.estate!.id,
        full_name: form.full_name.trim(),
        relationship: form.relationship.trim() || null,
        phone: form.phone.trim() || null,
        age: form.age ? Number(form.age) : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Dependent added");
      setOpen(false);
      setForm({ full_name: "", relationship: "", phone: "", age: "" });
      qc.invalidateQueries({ queryKey: ["dependents"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("dependents").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Removed");
      qc.invalidateQueries({ queryKey: ["dependents"] });
    },
  });

  return (
    <div className="space-y-4">
      <FadeIn>
        <button
          onClick={() => setOpen((o) => !o)}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary-dark"
        >
          <Plus className="h-4 w-4" /> {open ? "Close" : "Add dependent"}
        </button>
      </FadeIn>

      {open && (
        <FadeIn>
          <Card className="space-y-3 p-4">
            {[
              { key: "full_name", label: "Full name" },
              { key: "relationship", label: "Relationship" },
              { key: "phone", label: "Phone" },
              { key: "age", label: "Age" },
            ].map((f) => (
              <label key={f.key} className="block">
                <span className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  {f.label}
                </span>
                <input
                  value={(form as any)[f.key]}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </label>
            ))}
            <button
              onClick={() => add.mutate()}
              disabled={add.isPending}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary-dark disabled:opacity-60"
            >
              {add.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Save
            </button>
          </Card>
        </FadeIn>
      )}

      {!list.data || list.data.length === 0 ? (
        <EmptyState title="No dependents yet" icon={<Users className="h-6 w-6" />} />
      ) : (
        <Stagger className="space-y-2">
          {list.data.map((d) => (
            <StaggerItem key={d.id}>
              <Card className="flex items-center justify-between p-4">
                <div>
                  <div className="text-sm font-medium text-foreground">{d.full_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {[d.relationship, d.phone, d.age ? `${d.age} yrs` : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </div>
                <button
                  onClick={() => remove.mutate(d.id)}
                  className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </Card>
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </div>
  );
}
