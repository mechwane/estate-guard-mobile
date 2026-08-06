import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { Card, EmptyState, StatusBadge, SearchInput, StatCard } from "@/components/ui-kit";
import { Stagger, StaggerItem } from "@/components/motion-kit";
import { Store, Plus, Loader2, Pencil, Trash2, ImagePlus, X, ShoppingBag } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/app/admin/shop")({
  component: AdminShop,
  head: () => ({
    meta: [
      { title: "Products & Orders — Estate Guard" },
      {
        name: "description",
        content:
          "Manage estate products by category — access cards, vehicle tags, consumables, services and merchandise — and process resident orders.",
      },
      { property: "og:title", content: "Products & Orders — Estate Guard" },
      {
        property: "og:description",
        content: "Estate product catalogue and resident order processing.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const CATEGORIES = [
  { value: "access_card", label: "Access Card" },
  { value: "vehicle_tag", label: "Vehicle Tag" },
  { value: "consumable", label: "Consumable" },
  { value: "service", label: "Service" },
  { value: "merchandise", label: "Merchandise" },
  { value: "other", label: "Other" },
];

const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "processing",
  "ready",
  "completed",
  "cancelled",
  "rejected",
];

function catLabel(v: string) {
  return CATEGORIES.find((c) => c.value === v)?.label ?? v.replace("_", " ");
}

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
  category: "access_card",
  price_ngn: "0",
  active: true,
  image_url: "",
};

function AdminShop() {
  const { data: session } = useSession();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"products" | "orders">("products");
  const [cat, setCat] = useState<string>("all");
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
      if (!f.name.trim()) throw new Error("Title is required");
      const price = Number(f.price_ngn);
      if (isNaN(price) || price < 0) throw new Error("Cost must be a positive number");
      const payload = {
        estate_id: session!.estate!.id,
        name: f.name.trim(),
        description: f.description.trim() || null,
        category: f.category,
        price_ngn: price,
        active: f.active,
        image_url: f.image_url.trim() || null,
      };
      const query = f.id
        ? supabase.from("shop_items").update(payload).eq("id", f.id)
        : supabase.from("shop_items").insert(payload);
      const { error } = await query;
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Product saved");
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
      toast.success("Product removed");
      qc.invalidateQueries({ queryKey: ["admin-shop-items"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setOrderStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("shop_orders").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Order updated");
      qc.invalidateQueries({ queryKey: ["admin-shop-orders"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const all = items.data ?? [];
  const filteredItems = all.filter(
    (i) =>
      (cat === "all" || i.category === cat) &&
      (!q || i.name.toLowerCase().includes(q.toLowerCase())),
  );

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="flex items-center gap-2 text-lg font-semibold">
          <ShoppingBag className="h-5 w-5 text-primary" />
          {tab === "products" ? "Products" : "Orders"}
        </h1>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border bg-card p-0.5">
            {(["products", "orders"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize ${
                  tab === t ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          {tab === "products" && (
            <button
              onClick={() => setEditing({ ...EMPTY })}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold uppercase tracking-wide text-primary-foreground hover:bg-primary-dark"
            >
              <Plus className="h-4 w-4" /> New product
            </button>
          )}
        </div>
      </div>

      {tab === "products" && (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatCard label="Products" value={all.length} />
            <StatCard label="Active" value={all.filter((i) => i.active).length} tone="success" />
            <StatCard label="Inactive" value={all.filter((i) => !i.active).length} tone="warning" />
            <StatCard label="Categories" value={new Set(all.map((i) => i.category)).size} />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {[{ value: "all", label: "All" }, ...CATEGORIES].map((c) => (
              <button
                key={c.value}
                onClick={() => setCat(c.value)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                  cat === c.value
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-foreground hover:bg-muted"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          <div className="sm:max-w-xl">
            <SearchInput value={q} onChange={setQ} placeholder="Search products" />
          </div>

          {items.isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filteredItems.length === 0 ? (
            <EmptyState title="No product yet" icon={<Store className="h-6 w-6" />} />
          ) : (
            <Stagger className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {filteredItems.map((i) => (
                <StaggerItem key={i.id}>
                  <Card className="flex h-full flex-col overflow-hidden p-0">
                    <div className="flex h-32 items-center justify-center bg-muted">
                      {i.image_url ? (
                        <img
                          src={i.image_url}
                          alt={i.name}
                          loading="lazy"
                          className="h-32 w-full object-cover"
                        />
                      ) : (
                        <Store className="h-8 w-8 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex flex-1 flex-col gap-2 p-3.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-foreground">
                            {i.name}
                          </div>
                          <div className="text-xs text-muted-foreground">{catLabel(i.category)}</div>
                        </div>
                        <StatusBadge tone={i.active ? "success" : "neutral"}>
                          {i.active ? "active" : "inactive"}
                        </StatusBadge>
                      </div>
                      {i.description && (
                        <p className="line-clamp-2 text-xs text-muted-foreground">
                          {i.description}
                        </p>
                      )}
                      <div className="mt-auto flex items-center justify-between gap-2 pt-1">
                        <div className="text-sm font-semibold text-foreground">
                          ₦{Number(i.price_ngn).toLocaleString()}
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
                            aria-label={`Edit ${i.name}`}
                            className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => remove.mutate(i.id)}
                            aria-label={`Delete ${i.name}`}
                            className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-[color:var(--color-error)]"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </Card>
                </StaggerItem>
              ))}
            </Stagger>
          )}
        </>
      )}

      {tab === "orders" && (
        <>
          {orders.isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (orders.data ?? []).length === 0 ? (
            <EmptyState title="No orders yet" icon={<ShoppingBag className="h-6 w-6" />} />
          ) : (
            <Stagger className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {orders.data!.map((o) => (
                <StaggerItem key={o.id}>
                  <Card className="space-y-2 p-3.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-foreground">
                          {o.item_name ?? "Order"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(o.created_at), "d MMM yyyy HH:mm")}
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
                    <div className="text-sm font-semibold text-foreground">
                      ₦{Number(o.amount_ngn ?? 0).toLocaleString()}
                    </div>
                    <select
                      value={o.status}
                      onChange={(e) => setOrderStatus.mutate({ id: o.id, status: e.target.value })}
                      className="w-full rounded-lg border border-border bg-card px-3 py-2 text-xs capitalize outline-none focus:border-primary"
                    >
                      {ORDER_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </Card>
                </StaggerItem>
              ))}
            </Stagger>
          )}
        </>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-border bg-card p-4 shadow-xl sm:rounded-2xl">
            <div className="mb-3 flex items-center justify-between gap-2">
              <button
                onClick={() => setEditing(null)}
                aria-label="Close"
                className="rounded-full border border-border p-1.5 text-muted-foreground hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
              <h3 className="flex-1 text-center text-sm font-semibold">
                {editing.id ? "Edit product" : "Add product"}
              </h3>
              <span className="w-7" />
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                save.mutate(editing);
              }}
              className="space-y-3"
            >
              <div className="flex flex-col items-center gap-2">
                <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-xl border border-dashed border-border bg-muted">
                  {editing.image_url ? (
                    <img src={editing.image_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <ImagePlus className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                <input
                  value={editing.image_url}
                  onChange={(e) => setEditing({ ...editing, image_url: e.target.value })}
                  placeholder="Paste product image URL"
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-xs outline-none focus:border-primary"
                />
              </div>

              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted-foreground">Title</span>
                <input
                  required
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  placeholder="Product title"
                  className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </label>

              <div>
                <span className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  Category
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {CATEGORIES.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setEditing({ ...editing, category: c.value })}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                        editing.category === c.value
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card text-foreground hover:bg-muted"
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted-foreground">
                  Description <span className="italic">optional</span>
                </span>
                <textarea
                  rows={3}
                  value={editing.description}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  placeholder="Add a brief description"
                  className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted-foreground">
                  Item cost (₦)
                </span>
                <input
                  type="number"
                  min="0"
                  value={editing.price_ngn}
                  onChange={(e) => setEditing({ ...editing, price_ngn: e.target.value })}
                  className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </label>

              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={editing.active}
                  onChange={(e) => setEditing({ ...editing, active: e.target.checked })}
                />
                Active (visible to residents)
              </label>

              <button
                type="submit"
                disabled={save.isPending}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary-dark disabled:opacity-60"
              >
                {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Save product
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
