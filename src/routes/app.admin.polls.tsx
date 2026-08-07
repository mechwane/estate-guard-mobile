import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import { BarChart3, Image as ImageIcon, Pencil, Plus, Trash2, Vote, X } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import {
  Card,
  ConfirmActionDialog,
  EmptyState,
  ErrorState,
  ListSkeleton,
  ScrollTabs,
  SearchInput,
  SheetModal,
  StatCard,
  StatusBadge,
} from "@/components/ui-kit";
import { FadeIn, Stagger, StaggerItem } from "@/components/motion-kit";

export const Route = createFileRoute("/app/admin/polls")({
  component: AdminPolls,
  head: () => ({
    meta: [
      { title: "Polls & Elections — Estate Admin" },
      {
        name: "description",
        content:
          "Create estate polls and elections, set voting rules, and follow live results for every resident vote.",
      },
      { property: "og:title", content: "Polls & Elections — Estate Admin" },
      {
        property: "og:description",
        content: "Run estate polls and elections with live results and voting rules.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Kind = "poll" | "election";

type ItemForm = { id?: string; title: string; options: string[] };
type PollForm = {
  id?: string;
  kind: Kind;
  title: string;
  description: string;
  promo_image_url: string;
  how_to_win: "residents" | "address";
  allow_anonymous: boolean;
  starts_at: string;
  closes_at: string;
  items: ItemForm[];
};

const emptyForm = (kind: Kind): PollForm => ({
  kind,
  title: "",
  description: "",
  promo_image_url: "",
  how_to_win: "residents",
  allow_anonymous: false,
  starts_at: "",
  closes_at: "",
  items: [{ title: "", options: ["", ""] }],
});

function toLocalInput(value: string | null | undefined) {
  if (!value) return "";
  const d = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function sessionStatus(row: { starts_at: string | null; closes_at: string | null }) {
  const now = Date.now();
  if (row.starts_at && new Date(row.starts_at).getTime() > now) return "Scheduled" as const;
  if (row.closes_at && new Date(row.closes_at).getTime() < now) return "Closed" as const;
  return "Active" as const;
}

function AdminPolls() {
  const { data: session } = useSession();
  const estateId = session?.estate?.id;
  const qc = useQueryClient();

  const [kind, setKind] = useState<Kind>("election");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<PollForm | null>(null);
  const [deleting, setDeleting] = useState<{ id: string; title: string } | null>(null);
  const [resultsFor, setResultsFor] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ["admin-polls", estateId],
    enabled: !!estateId,
    queryFn: async () => {
      const [polls, items, votes] = await Promise.all([
        supabase
          .from("polls")
          .select("*")
          .eq("estate_id", estateId!)
          .order("created_at", { ascending: false }),
        supabase.from("poll_items").select("*").order("position", { ascending: true }),
        supabase.rpc("poll_vote_tallies" as never),
      ]);
      const error = [polls.error, items.error, votes.error].find(Boolean);
      if (error) throw error;
      return {
        polls: polls.data ?? [],
        items: items.data ?? [],
        votes: ((votes.data ?? []) as unknown as {
          poll_id: string;
          item_id: string | null;
          option_key: string;
          votes: number;
        }[]).map((v) => ({ ...v, votes: Number(v.votes) })),
      };
    },
  });


  const rows = useMemo(() => {
    const data = list.data;
    if (!data) return [];
    const term = search.trim().toLowerCase();
    return data.polls
      .filter((p) => (p.kind ?? "poll") === kind)
      .filter((p) => !term || p.title.toLowerCase().includes(term))
      .map((p) => ({
        ...p,
        items: data.items.filter((i) => i.poll_id === p.id),
        voteCount: data.votes
          .filter((v) => v.poll_id === p.id)
          .reduce((sum, v) => sum + v.votes, 0),

      }));
  }, [list.data, kind, search]);

  const stats = useMemo(() => {
    const active = rows.filter((r) => sessionStatus(r) === "Active").length;
    const closed = rows.filter((r) => sessionStatus(r) === "Closed").length;
    const votes = rows.reduce((sum, r) => sum + r.voteCount, 0);
    return { total: rows.length, active, closed, votes };
  }, [rows]);

  const save = useMutation({
    mutationFn: async (f: PollForm) => {
      if (!f.title.trim()) throw new Error("Title is required");
      const items = f.items
        .map((i) => ({
          ...i,
          title: i.title.trim(),
          options: i.options.map((o) => o.trim()).filter(Boolean),
        }))
        .filter((i) => i.title);
      if (items.length === 0)
        throw new Error(f.kind === "election" ? "Add at least one post" : "Add at least one question");
      if (items.some((i) => i.options.length < 2))
        throw new Error("Every entry needs at least two options");

      const payload = {
        estate_id: estateId!,
        title: f.title.trim(),
        description: f.description.trim() || null,
        kind: f.kind,
        promo_image_url: f.promo_image_url.trim() || null,
        how_to_win: f.how_to_win,
        allow_anonymous: f.allow_anonymous,
        starts_at: f.starts_at ? new Date(f.starts_at).toISOString() : null,
        closes_at: f.closes_at ? new Date(f.closes_at).toISOString() : null,
        options: items[0]!.options,
        created_by: session?.userId ?? null,
      };

      let pollId = f.id;
      if (pollId) {
        const { error } = await supabase.from("polls").update(payload).eq("id", pollId);
        if (error) throw error;
        const { error: delError } = await supabase
          .from("poll_items")
          .delete()
          .eq("poll_id", pollId);
        if (delError) throw delError;
      } else {
        const { data, error } = await supabase.from("polls").insert(payload).select("id").single();
        if (error) throw error;
        pollId = data.id;
      }

      const { error: itemsError } = await supabase.from("poll_items").insert(
        items.map((i, index) => ({
          poll_id: pollId!,
          title: i.title,
          options: i.options,
          position: index,
        })),
      );
      if (itemsError) throw itemsError;
    },
    onSuccess: () => {
      toast.success("Saved");
      setForm(null);
      qc.invalidateQueries({ queryKey: ["admin-polls"] });
      qc.invalidateQueries({ queryKey: ["polls"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("polls").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Deleted");
      setDeleting(null);
      qc.invalidateQueries({ queryKey: ["admin-polls"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resultsRow = rows.find((r) => r.id === resultsFor) ?? null;

  if (!estateId)
    return (
      <EmptyState
        title="No estate assigned"
        description="Your admin account is not linked to an estate yet."
      />
    );

  const noun = kind === "election" ? "election" : "poll";

  return (
    <div className="space-y-4">
      <ScrollTabs
        value={kind}
        onChange={setKind}
        tabs={
          [
            { key: "election", label: "Elections" },
            { key: "poll", label: "Polls" },
          ] as const
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label={`Total ${noun}s`} value={stats.total} />
        <StatCard label="Active" value={stats.active} tone={stats.active ? "success" : "default"} />
        <StatCard label="Closed" value={stats.closed} />
        <StatCard label="Votes cast" value={stats.votes} tone={stats.votes ? "primary" : "default"} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1 sm:max-w-xs">
          <SearchInput value={search} onChange={setSearch} placeholder={`Search ${noun}s…`} />
        </div>
        <button
          onClick={() => setForm(emptyForm(kind))}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-dark"
        >
          <Plus className="h-4 w-4" /> New {noun}
        </button>
      </div>

      {list.isLoading ? (
        <ListSkeleton rows={4} />
      ) : list.isError ? (
        <ErrorState onRetry={() => list.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState
          title={`No ${noun}s yet`}
          description={
            kind === "election"
              ? "Create an election, add the posts residents will vote for, and publish it."
              : "Create a poll, add your questions and options, and publish it to residents."
          }
          icon={<Vote className="h-6 w-6" />}
        />
      ) : (
        <Stagger className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((row) => {
            const status = sessionStatus(row);
            return (
              <StaggerItem key={row.id}>
                <Card className="flex h-full flex-col overflow-hidden">
                  <div className="relative h-32 w-full bg-muted">
                    {row.promo_image_url ? (
                      <MediaImage
                        value={row.promo_image_url}
                        alt={`${row.title} promotional banner`}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                        <ImageIcon className="h-6 w-6" />
                      </div>
                    )}
                    <div className="absolute left-2 top-2">
                      <StatusBadge
                        tone={
                          status === "Active"
                            ? "success"
                            : status === "Scheduled"
                              ? "warning"
                              : "neutral"
                        }
                      >
                        {status}
                      </StatusBadge>
                    </div>
                  </div>
                  <div className="flex flex-1 flex-col gap-2 p-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-foreground">
                        {row.title}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {row.starts_at ? format(new Date(row.starts_at), "MMM d, HH:mm") : "Open"} →{" "}
                        {row.closes_at ? format(new Date(row.closes_at), "MMM d, HH:mm") : "No end"}
                      </div>
                    </div>
                    {row.description && (
                      <p className="line-clamp-2 text-xs text-muted-foreground">{row.description}</p>
                    )}
                    <div className="flex flex-wrap gap-1.5 text-[11px]">
                      <StatusBadge>
                        {row.items.length} {kind === "election" ? "post(s)" : "question(s)"}
                      </StatusBadge>
                      <StatusBadge tone="primary">{row.voteCount} vote(s)</StatusBadge>
                      <StatusBadge>
                        {row.how_to_win === "address" ? "1 vote / address" : "1 vote / resident"}
                      </StatusBadge>
                      {row.allow_anonymous && <StatusBadge>Anonymous</StatusBadge>}
                    </div>
                    <div className="mt-auto flex gap-2 pt-1">
                      <button
                        onClick={() => setResultsFor(row.id)}
                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
                      >
                        <BarChart3 className="h-3.5 w-3.5" /> Results
                      </button>
                      <button
                        onClick={() =>
                          setForm({
                            id: row.id,
                            kind: (row.kind as Kind) ?? "poll",
                            title: row.title,
                            description: row.description ?? "",
                            promo_image_url: row.promo_image_url ?? "",
                            how_to_win: (row.how_to_win as "residents" | "address") ?? "residents",
                            allow_anonymous: !!row.allow_anonymous,
                            starts_at: toLocalInput(row.starts_at),
                            closes_at: toLocalInput(row.closes_at),
                            items: row.items.length
                              ? row.items.map((i) => ({
                                  id: i.id,
                                  title: i.title,
                                  options: ((i.options as string[] | null) ?? []).map(String),
                                }))
                              : [{ title: row.title, options: (row.options as string[]) ?? [] }],
                          })
                        }
                        aria-label={`Edit ${row.title}`}
                        className="rounded-lg border border-border bg-card p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <Pencil className="h-3.5 w-3.5" />
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
            );
          })}
        </Stagger>
      )}

      <SheetModal
        open={!!form}
        title={form?.id ? `Edit ${noun}` : `New ${noun}`}
        onClose={() => setForm(null)}
        width="lg"
        footer={
          <div className="flex gap-2">
            <button
              onClick={() => setForm(null)}
              className="flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
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
            <Field label="Type">
              <select
                value={form.kind}
                onChange={(e) => setForm({ ...form, kind: e.target.value as Kind })}
                className={inputClass}
              >
                <option value="election">Election</option>
                <option value="poll">Poll</option>
              </select>
            </Field>
            <Field label="Title">
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder={
                  form.kind === "election" ? "2026 Estate Exco Election" : "Estate gate closing time"
                }
                className={inputClass}
              />
            </Field>
            <Field label="Description">
              <textarea
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className={inputClass}
              />
            </Field>
            <ImagePicker
              label="Promo image (optional)"
              folder="polls"
              value={form.promo_image_url || null}
              onChange={(v) => setForm({ ...form, promo_image_url: v ?? "" })}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Starts at">
                <input
                  type="datetime-local"
                  value={form.starts_at}
                  onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
                  className={inputClass}
                />
              </Field>
              <Field label="Ends at">
                <input
                  type="datetime-local"
                  value={form.closes_at}
                  onChange={(e) => setForm({ ...form, closes_at: e.target.value })}
                  className={inputClass}
                />
              </Field>
            </div>
            <Field label="Who can vote">
              <select
                value={form.how_to_win}
                onChange={(e) =>
                  setForm({ ...form, how_to_win: e.target.value as "residents" | "address" })
                }
                className={inputClass}
              >
                <option value="residents">One vote per resident</option>
                <option value="address">One vote per address</option>
              </select>
            </Field>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={form.allow_anonymous}
                onChange={(e) => setForm({ ...form, allow_anonymous: e.target.checked })}
                className="h-4 w-4 rounded border-border"
              />
              Hide voter identities (anonymous results)
            </label>

            <div className="space-y-3 rounded-xl border border-border p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {form.kind === "election" ? "Posts & candidates" : "Questions & options"}
                </span>
                <button
                  onClick={() =>
                    setForm({ ...form, items: [...form.items, { title: "", options: ["", ""] }] })
                  }
                  className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs font-medium hover:bg-muted"
                >
                  <Plus className="h-3.5 w-3.5" /> Add
                </button>
              </div>
              {form.items.map((item, itemIndex) => (
                <div key={itemIndex} className="space-y-2 rounded-lg bg-muted/40 p-2.5">
                  <div className="flex items-center gap-2">
                    <input
                      value={item.title}
                      onChange={(e) => {
                        const items = [...form.items];
                        items[itemIndex] = { ...item, title: e.target.value };
                        setForm({ ...form, items });
                      }}
                      placeholder={form.kind === "election" ? "Chairman" : "Question"}
                      className={inputClass}
                    />
                    {form.items.length > 1 && (
                      <button
                        onClick={() =>
                          setForm({
                            ...form,
                            items: form.items.filter((_, i) => i !== itemIndex),
                          })
                        }
                        aria-label="Remove entry"
                        className="rounded-lg border border-border p-1.5 text-muted-foreground hover:text-destructive"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  {item.options.map((option, optionIndex) => (
                    <div key={optionIndex} className="flex items-center gap-2">
                      <input
                        value={option}
                        onChange={(e) => {
                          const items = [...form.items];
                          const options = [...item.options];
                          options[optionIndex] = e.target.value;
                          items[itemIndex] = { ...item, options };
                          setForm({ ...form, items });
                        }}
                        placeholder={form.kind === "election" ? "Candidate name" : "Option"}
                        className={inputClass}
                      />
                      {item.options.length > 2 && (
                        <button
                          onClick={() => {
                            const items = [...form.items];
                            items[itemIndex] = {
                              ...item,
                              options: item.options.filter((_, i) => i !== optionIndex),
                            };
                            setForm({ ...form, items });
                          }}
                          aria-label="Remove option"
                          className="rounded-lg border border-border p-1.5 text-muted-foreground hover:text-destructive"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    onClick={() => {
                      const items = [...form.items];
                      items[itemIndex] = { ...item, options: [...item.options, ""] };
                      setForm({ ...form, items });
                    }}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    + Add {form.kind === "election" ? "candidate" : "option"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </SheetModal>

      <SheetModal
        open={!!resultsRow}
        title={resultsRow ? `${resultsRow.title} — results` : "Results"}
        onClose={() => setResultsFor(null)}
        width="lg"
      >
        {resultsRow && (
          <FadeIn className="space-y-4">
            {resultsRow.items.length === 0 ? (
              <EmptyState title="No questions on this session" />
            ) : (
              resultsRow.items.map((item) => {
                const votes = (list.data?.votes ?? []).filter(
                  (v) => v.poll_id === resultsRow.id && v.item_id === item.id,
                );
                const options = ((item.options as string[] | null) ?? []).map(String);
                const total = votes.reduce((sum, v) => sum + v.votes, 0);
                return (
                  <div key={item.id} className="space-y-2">
                    <div className="flex items-center justify-between text-sm font-medium text-foreground">
                      <span className="truncate">{item.title}</span>
                      <span className="text-xs text-muted-foreground">{total} vote(s)</span>
                    </div>
                    {options.map((option) => {
                      const count = votes
                        .filter((v) => v.option_key === option)
                        .reduce((sum, v) => sum + v.votes, 0);
                      const pct = total ? Math.round((count / total) * 100) : 0;
                      return (

                        <div key={option} className="space-y-1">
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span className="truncate">{option}</span>
                            <span>
                              {count} · {pct}%
                            </span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-primary transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })
            )}
          </FadeIn>
        )}
      </SheetModal>

      <ConfirmActionDialog
        open={!!deleting}
        title={`Delete “${deleting?.title ?? ""}”?`}
        description="Votes recorded for this session will also be removed."
        confirmLabel="Delete"
        tone="destructive"
        busy={remove.isPending}
        onCancel={() => setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
      />
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
