import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { Card, EmptyState, StatusBadge } from "@/components/ui-kit";
import { FadeIn, Stagger, StaggerItem } from "@/components/motion-kit";
import { IdCard, Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/resident/ids")({
  component: IDs,
});

const ID_TYPES = ["NIN", "Driver's License", "International Passport", "Voter's Card"];

function IDs() {
  const { data: session } = useSession();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ id_type: ID_TYPES[0], id_number: "" });

  const list = useQuery({
    queryKey: ["resident-ids", session?.userId],
    enabled: !!session?.userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("resident_ids")
        .select("*")
        .eq("resident_id", session!.userId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      if (!form.id_number.trim()) throw new Error("ID number required");
      const { error } = await supabase.from("resident_ids").insert({
        resident_id: session!.userId!,
        id_type: form.id_type,
        id_number: form.id_number.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("ID saved");
      setOpen(false);
      setForm({ id_type: ID_TYPES[0], id_number: "" });
      qc.invalidateQueries({ queryKey: ["resident-ids"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("resident_ids").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["resident-ids"] }),
  });

  return (
    <div className="space-y-4">
      <FadeIn>
        <button
          onClick={() => setOpen((o) => !o)}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary-dark"
        >
          <Plus className="h-4 w-4" /> {open ? "Close" : "Add ID"}
        </button>
      </FadeIn>

      {open && (
        <FadeIn>
          <Card className="space-y-3 p-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-muted-foreground">
                ID type
              </span>
              <select
                value={form.id_type}
                onChange={(e) => setForm({ ...form, id_type: e.target.value })}
                className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              >
                {ID_TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-muted-foreground">
                ID number
              </span>
              <input
                value={form.id_number}
                onChange={(e) => setForm({ ...form, id_number: e.target.value })}
                className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </label>
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
        <EmptyState title="No IDs saved yet" icon={<IdCard className="h-6 w-6" />} />
      ) : (
        <Stagger className="space-y-2">
          {list.data.map((d) => (
            <StaggerItem key={d.id}>
              <Card className="flex items-center justify-between p-4">
                <div>
                  <div className="text-sm font-medium text-foreground">{d.id_type}</div>
                  <div className="text-xs text-muted-foreground">{d.id_number}</div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge tone={d.verified ? "success" : "warning"}>
                    {d.verified ? "verified" : "pending"}
                  </StatusBadge>
                  <button
                    onClick={() => remove.mutate(d.id)}
                    className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </Card>
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </div>
  );
}
