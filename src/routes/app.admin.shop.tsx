import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { Card, EmptyState, StatusBadge, SearchInput } from "@/components/ui-kit";
import { FadeIn, Stagger, StaggerItem } from "@/components/motion-kit";
import { Store, Plus, Loader2, Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/app/admin/shop")({
  component: AdminShop,
});

const CATEGORIES = ["service", "consumable", "vehicle_tag", "merchandise", "other"];
const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "processing",
  "ready",
  "completed",
  "cancelled",
  "rejected",
];

type ItemForm = {
  id?: string;
  name: string;
  description: string;
  category: string;
  price_ngn: string;
  active: boolean;
  image_url: string;
};

const EMPTY: ItemForm = {
  name: "",
  description: "",
  category: "service",
  price_ngn: "0",
  active: true,
  image_url: "",
};

function AdminShop() {
  const { data: session } = useSession();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"items" | "orders">("items");
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<ItemForm | null>(null);

  const items = useQuery({
    queryKey: ["admin-shop-items", session?.estate?.id],
    enabled: !!session?.estate?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shop_items")
        .select("*")
        .eq("estate_id", session!.estate!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const orders = useQuery({
    queryKey: ["admin-shop-orders", session?.estate?.id],
    enabled: !!session?.estate?.id && tab === "orders",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shop_orders")
        .select("*")
        .eq("estate_id", session!.estate!.id)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });

  const save = useMutation({
    mutationFn: async (f: ItemForm) => {
      if (!f.name.trim()) throw new Error("Name required");
      const price = Number(f.price_ngn);
      if (isNaN(price) || price < 0) throw new Error("Price must be a positive number");
      const payload = {
        estate_id: session!.estate!.id,
        name: f.name.trim(),
        description: f.description.trim() || null,
        category: f.category,
        price_ngn: price,
        active: f.active,
        image_url: f.image_url.trim() || null,
      };
      const q = f.id
        ? supabase.from("shop_items").update(payload).eq("id", f.id)
        : supabase.from("shop_items").insert(payload);
      const { error } = await q;
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Saved");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["admin-shop-items"] });
      qc.invalidateQueries({ queryKey: ["shop-items"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("shop_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Removed");
      qc.invalidateQueries({ queryKey: ["admin-shop-items"] });
    },
  });

  const setOrderStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("shop_orders").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-shop-orders"] }),
  });

  const filteredItems = (items.data ?? []).filter(
    (i) => !q || i.name.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(["items", "orders"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium capitalize ${
              tab === t
                ? "bg-primary text-primary-foreground"
                : "border border-border bg-card text-foreground hover:bg-muted"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "items" && (
        <>
          <div className="flex gap-2">
            <div className="flex-1">
              <SearchInput value={q} onChange={setQ} placeholder="Search items" />
            </div>
            <button
              onClick={() => setEditing({ ...EMPTY })}
              className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-dark"
            >
              <Plus className="h-4 w-4" /> New
            </button>
          </div>

          {editing && (
            <FadeIn>
              <Card className="space-y-3 p-4">
                <Label label="Name">
                  <TextInput
                    value={editing.name}
                    onChange={(v) => setEditing({ ...editing, name: v })}
                  />
                </Label>
                <Label label="Description">
                  <textarea
                    rows={3}
                    value={editing.description}
                    onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                    className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  <Label label="Category">
                    <select
                      value={editing.category}
                      onChange={(e) => setEditing({ ...editing, category: e.target.value })}
                      className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </Label>
                  <Label label="Price (₦)">
                    <TextInput
                      type="number"
                      value={editing.price_ngn}
                      onChange={(v) => setEditing({ ...editing, price_ngn: v })}
                    />
                  </Label>
                </div>
                <Label label="Image URL (optional)">
                  <TextInput
                    value={editing.image_url}
                    onChange={(v) => setEditing({ ...editing, image_url: v })}
                  />
                </Label>
                <label className="flex items-center gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={editing.active}
                    onChange={(e) => setEditing({ ...editing, active: e.target.checked })}
                  />
                  Active (visible to residents)
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditing(null)}
                    className="flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => save.mutate(editing)}
                    disabled={save.isPending}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-dark disabled:opacity-60"
                  >
                    {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Save
                  </button>
                </div>
              </Card>
            </FadeIn>
          )}

          {items.isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filteredItems.length === 0 ? (
            <EmptyState title="No items yet" icon={<Store className="h-6 w-6" />} />
          ) : (
            <Stagger className="space-y-2">
              {filteredItems.map((i) => (
                <StaggerItem key={i.id}>
                  <Card className="flex items-center justify-between p-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-foreground">{i.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {i.category} · ₦{Number(i.price_ngn).toLocaleString()} ·{" "}
                        {i.active ? "active" : "inactive"}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() =>
                          setEditing({
                            id: i.id,
                            name: i.name,
                            description: i.description ?? "",
                            category: i.category,
                            price_ngn: String(i.price_ngn),
                            active: i.active,
                            image_url: i.image_url ?? "",
                          })
                        }
                        className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Delete ${i.name}?`)) remove.mutate(i.id);
                        }}
                        className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </Card>
                </StaggerItem>
              ))}
            </Stagger>
          )}
        </>
      )}

      {tab === "orders" && (
        <div className="space-y-2">
          {orders.isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : !orders.data || orders.data.length === 0 ? (
            <EmptyState title="No orders yet" />
          ) : (
            orders.data.map((o) => (
              <Card key={o.id} className="p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-foreground">
                      {o.item_name} × {o.quantity}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      ₦{Number(o.amount_ngn).toLocaleString()} ·{" "}
                      {format(new Date(o.created_at), "MMM d, HH:mm")}
                    </div>
                  </div>
                  <StatusBadge
                    tone={
                      o.status === "completed"
                        ? "success"
                        : o.status === "cancelled" || o.status === "rejected"
                          ? "error"
                          : "warning"
                    }
                  >
                    {o.status}
                  </StatusBadge>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {ORDER_STATUSES.map((s) => (
                    <button
                      key={s}
                      disabled={s === o.status || setOrderStatus.isPending}
                      onClick={() => setOrderStatus.mutate({ id: o.id, status: s })}
                      className={`rounded-full px-2.5 py-1 text-[11px] font-medium capitalize ${
                        s === o.status
                          ? "bg-muted text-muted-foreground"
                          : "border border-border bg-card text-foreground hover:bg-muted"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function Label({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
function TextInput({
  value,
  onChange,
  ...rest
}: { value: string; onChange: (v: string) => void } & Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange"
>) {
  return (
    <input
      {...rest}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
    />
  );
}
