import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import { Image as ImageIcon, Megaphone, Pencil, Plus, Trash2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import {
  Card,
  ConfirmActionDialog,
  EmptyState,
  ErrorState,
  ImagePicker,
  ListSkeleton,
  MediaImage,
  SearchInput,
  SheetModal,
  StatCard,
} from "@/components/ui-kit";
import { Stagger, StaggerItem } from "@/components/motion-kit";

export const Route = createFileRoute("/app/admin/announcements")({
  component: AdminAnnouncements,
  head: () => ({
    meta: [
      { title: "Announcements — Estate Admin" },
      {
        name: "description",
        content:
          "Publish estate announcements with cover images and keep every resident informed from one place.",
      },
      { property: "og:title", content: "Announcements — Estate Admin" },
      {
        property: "og:description",
        content: "Publish and manage estate announcements for residents.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Form = { id?: string; title: string; body: string; cover_url: string };
const EMPTY: Form = { title: "", body: "", cover_url: "" };

const inputClass =
  "w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

function AdminAnnouncements() {
  const { data: session } = useSession();
  const estateId = session?.estate?.id;
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<Form | null>(null);
  const [deleting, setDeleting] = useState<{ id: string; title: string } | null>(null);

  const list = useQuery({
    queryKey: ["admin-announcements", estateId],
    enabled: !!estateId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("community_posts")
        .select("*")
        .eq("estate_id", estateId!)
        .eq("post_type", "announcement")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (list.data ?? []).filter(
      (row) =>
        !term || row.title.toLowerCase().includes(term) || row.body.toLowerCase().includes(term),
    );
  }, [list.data, search]);

  const thisMonth = useMemo(
    () =>
      (list.data ?? []).filter((row) => new Date(row.created_at) >= new Date(new Date().setDate(1)))
        .length,
    [list.data],
  );

  const save = useMutation({
    mutationFn: async (f: Form) => {
      if (!f.title.trim() || !f.body.trim()) throw new Error("Title and body are required");
      const payload = {
        estate_id: estateId!,
        author_id: session!.userId!,
        post_type: "announcement",
        title: f.title.trim(),
        body: f.body.trim(),
        cover_url: f.cover_url.trim() || null,
      };
      const { error } = f.id
        ? await supabase.from("community_posts").update(payload).eq("id", f.id)
        : await supabase.from("community_posts").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Announcement published");
      setForm(null);
      qc.invalidateQueries({ queryKey: ["admin-announcements"] });
      qc.invalidateQueries({ queryKey: ["community"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("community_posts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Deleted");
      setDeleting(null);
      qc.invalidateQueries({ queryKey: ["admin-announcements"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!estateId)
    return (
      <EmptyState
        title="No estate assigned"
        description="Your admin account is not linked to an estate yet."
      />
    );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Announcements" value={list.data?.length ?? 0} />
        <StatCard label="This month" value={thisMonth} tone={thisMonth ? "primary" : "default"} />
        <StatCard
          label="With cover image"
          value={(list.data ?? []).filter((row) => row.cover_url).length}
        />
        <StatCard label="Estate" value={session?.estate?.name ?? "—"} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1 sm:max-w-xs">
          <SearchInput value={search} onChange={setSearch} placeholder="Search announcements…" />
        </div>
        <button
          onClick={() => setForm({ ...EMPTY })}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-dark"
        >
          <Plus className="h-4 w-4" /> New announcement
        </button>
      </div>

      {list.isLoading ? (
        <ListSkeleton rows={4} />
      ) : list.isError ? (
        <ErrorState onRetry={() => list.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No announcements yet"
          description="Publish your first announcement and every resident will see it in their feed."
          icon={<Megaphone className="h-6 w-6" />}
        />
      ) : (
        <Stagger className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((row) => (
            <StaggerItem key={row.id}>
              <Card className="flex h-full flex-col overflow-hidden">
                <div className="h-28 w-full bg-muted">
                  <MediaImage
                    value={row.cover_url}
                    alt={`${row.title} cover`}
                    className="h-full w-full object-cover"
                    fallback={<ImageIcon className="h-6 w-6" />}
                  />
                </div>
                <div className="flex flex-1 flex-col gap-1.5 p-3">
                  <div className="truncate text-sm font-semibold text-foreground">{row.title}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {format(new Date(row.created_at), "MMM d, yyyy · HH:mm")}
                  </div>
                  <p className="line-clamp-3 whitespace-pre-wrap text-xs text-muted-foreground">
                    {row.body}
                  </p>
                  <div className="mt-auto flex gap-2 pt-2">
                    <button
                      onClick={() =>
                        setForm({
                          id: row.id,
                          title: row.title,
                          body: row.body,
                          cover_url: row.cover_url ?? "",
                        })
                      }
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium hover:bg-muted"
                    >
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </button>
                    <button
                      onClick={() => setDeleting({ id: row.id, title: row.title })}
                      aria-label={`Delete ${row.title}`}
                      className="rounded-lg border border-border bg-card p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </Card>
            </StaggerItem>
          ))}
        </Stagger>
      )}

      <SheetModal
        open={!!form}
        title={form?.id ? "Edit announcement" : "New announcement"}
        onClose={() => setForm(null)}
        width="lg"
        footer={
          <div className="flex gap-2">
            <button
              onClick={() => setForm(null)}
              className="flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted"
            >
              Cancel
            </button>
            <button
              onClick={() => form && save.mutate(form)}
              disabled={save.isPending}
              className="flex-1 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-dark disabled:opacity-60"
            >
              {save.isPending ? "Saving…" : "Publish"}
            </button>
          </div>
        }
      >
        {form && (
          <div className="space-y-3">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Title</span>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Message
              </span>
              <textarea
                rows={7}
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                className={inputClass}
              />
            </label>
            <ImagePicker
              label="Cover image (optional)"
              folder="announcements"
              value={form.cover_url || null}
              onChange={(v) => setForm({ ...form, cover_url: v ?? "" })}
            />
          </div>
        )}
      </SheetModal>

      <ConfirmActionDialog
        open={!!deleting}
        title={`Delete “${deleting?.title ?? ""}”?`}
        description="Residents will no longer see this announcement."
        confirmLabel="Delete"
        tone="destructive"
        busy={remove.isPending}
        onCancel={() => setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
      />
    </div>
  );
}
