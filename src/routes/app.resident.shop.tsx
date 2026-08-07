import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { Card, EmptyState, SearchInput } from "@/components/ui-kit";
import { FadeIn, Stagger, StaggerItem } from "@/components/motion-kit";
import { Store, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/resident/shop")({
  component: Shop,
});

const CATEGORIES = ["all", "service", "consumable", "vehicle_tag"] as const;
type Cat = (typeof CATEGORIES)[number];

function Shop() {
  const { data: session } = useSession();
  const qc = useQueryClient();
  const [cat, setCat] = useState<Cat>("all");
  const [q, setQ] = useState("");

  const items = useQuery({
    queryKey: ["shop-items", session?.estate?.id],
    enabled: !!session?.estate?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shop_items")
        .select("*")
        .eq("estate_id", session!.estate!.id)
        .eq("active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const order = useMutation({
    mutationFn: async (item: any) => {
      const { error } = await supabase.rpc("place_shop_order", {
        _item_id: item.id,
        _quantity: 1,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Order placed");
      qc.invalidateQueries({ queryKey: ["shop-orders"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = (items.data ?? [])
    .filter((i) => cat === "all" || i.category === cat)
    .filter((i) => !q || i.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-4">
      <FadeIn>
        <SearchInput value={q} onChange={setQ} placeholder="Search the store" />
      </FadeIn>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={`whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-medium capitalize transition-colors ${
              cat === c
                ? "bg-primary text-primary-foreground"
                : "border border-border bg-card text-foreground hover:bg-muted"
            }`}
          >
            {c.replace("_", " ")}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No items found" icon={<Store className="h-6 w-6" />} />
      ) : (
        <Stagger className="grid grid-cols-2 gap-3">
          {filtered.map((i) => (
            <StaggerItem key={i.id}>
              <Card className="flex h-full flex-col gap-2 p-3">
                <div className="aspect-square overflow-hidden rounded-lg bg-gradient-to-br from-muted to-muted/50">
                  {i.image_url && (
                    <MediaImage value={i.image_url} alt={i.name} className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="text-sm font-medium text-foreground">{i.name}</div>
                <div className="text-xs text-muted-foreground line-clamp-2">{i.description}</div>
                <div className="mt-auto flex items-center justify-between pt-1">
                  <span className="text-sm font-semibold tabular-nums text-foreground">
                    ₦{Number(i.price_ngn).toLocaleString()}
                  </span>
                  <button
                    disabled={order.isPending}
                    onClick={() => order.mutate(i)}
                    className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary-dark disabled:opacity-60"
                  >
                    {order.isPending && <Loader2 className="h-3 w-3 animate-spin" />} Order
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
