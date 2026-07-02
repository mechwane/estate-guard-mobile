import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { Card, StatusBadge } from "@/components/ui-kit";
import { toast } from "sonner";
import { Loader2, Upload, FileCheck2, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type OccupantType = Database["public"]["Enums"]["occupant_type"];

export const Route = createFileRoute("/app/resident/verification")({
  component: Verification,
});

function statusMeta(s: string | null | undefined) {
  switch (s) {
    case "approved": return { tone: "success" as const, label: "Approved", icon: <CheckCircle2 className="h-4 w-4" /> };
    case "pending": return { tone: "warning" as const, label: "Pending review", icon: <Clock className="h-4 w-4" /> };
    case "rejected": return { tone: "error" as const, label: "Rejected", icon: <AlertTriangle className="h-4 w-4" /> };
    default: return { tone: "neutral" as const, label: "Not submitted", icon: <FileCheck2 className="h-4 w-4" /> };
  }
}

function Verification() {
  const { data: session, refetch } = useSession();
  const qc = useQueryClient();
  const p = session?.profile as any;
  const meta = statusMeta(p?.verification_status);
  const locked = p?.verification_status === "pending" || p?.verification_status === "approved";

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [houseNumber, setHouseNumber] = useState("");
  const [block, setBlock] = useState("");
  const [street, setStreet] = useState("");
  const [occupantType, setOccupantType] = useState<OccupantType>("resident");
  const [docPath, setDocPath] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!p) return;
    setFullName(p.full_name ?? "");
    setPhone(p.phone ?? "");
    setHouseNumber(p.house_number ?? "");
    setBlock(p.block ?? "");
    setStreet(p.street ?? "");
    setOccupantType((p.occupant_type as OccupantType) ?? "resident");
    setDocPath(p.verification_doc_path ?? null);
  }, [p?.id]);

  const uploadDoc = useMutation({
    mutationFn: async (file: File) => {
      if (!session?.userId) throw new Error("Not signed in");
      if (!/^(image\/(png|jpe?g|webp)|application\/pdf)$/.test(file.type)) throw new Error("PDF, PNG, JPG or WEBP only");
      if (file.size > 8 * 1024 * 1024) throw new Error("Max 8MB");
      const ext = file.name.split(".").pop() || "bin";
      const path = `${session.userId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("verification-docs").upload(path, file, { upsert: false });
      if (error) throw error;
      setDocPath(path);
      toast.success("Document uploaded");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const submit = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("submit_verification", {
        _full_name: fullName,
        _phone: phone || "",
        _house_number: houseNumber,
        _block: block || "",
        _street: street,
        _occupant_type: occupantType,
        _doc_path: docPath ?? "",
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Submitted for review"); qc.invalidateQueries({ queryKey: ["session"] }); refetch(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const viewDoc = async () => {
    if (!docPath) return;
    const { data, error } = await supabase.storage.from("verification-docs").createSignedUrl(docPath, 300);
    if (error) return toast.error(error.message);
    window.open(data.signedUrl, "_blank");
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium">
            <span className="text-muted-foreground">{meta.icon}</span> Verification status
          </div>
          <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
        </div>
        {p?.verification_status === "rejected" && p?.verification_notes && (
          <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
            <div className="font-medium">Reviewer notes</div>
            <div className="mt-1 text-destructive/90">{p.verification_notes}</div>
            <div className="mt-2 text-destructive/80">Please correct the details below and resubmit.</div>
          </div>
        )}
        {p?.verification_status === "approved" && (
          <p className="mt-2 text-xs text-muted-foreground">Your details have been approved. Contact the estate admin to make changes.</p>
        )}
      </Card>

      <Card className="space-y-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Personal information</div>
        <Field label="Full name">
          <input disabled={locked} value={fullName} onChange={(e) => setFullName(e.target.value)} className="input disabled:opacity-60" />
        </Field>
        <Field label="Phone">
          <input disabled={locked} value={phone} onChange={(e) => setPhone(e.target.value)} className="input disabled:opacity-60" />
        </Field>
        <Field label="Occupant type">
          <select disabled={locked} value={occupantType} onChange={(e) => setOccupantType(e.target.value as OccupantType)} className="input disabled:opacity-60">
            <option value="owner">Owner</option>
            <option value="tenant">Tenant</option>
            <option value="family">Family member</option>
          </select>
        </Field>
      </Card>

      <Card className="space-y-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Address in estate</div>
        <Field label="House / unit number">
          <input disabled={locked} value={houseNumber} onChange={(e) => setHouseNumber(e.target.value)} className="input disabled:opacity-60" />
        </Field>
        <Field label="Block (optional)">
          <input disabled={locked} value={block} onChange={(e) => setBlock(e.target.value)} className="input disabled:opacity-60" />
        </Field>
        <Field label="Street">
          <input disabled={locked} value={street} onChange={(e) => setStreet(e.target.value)} className="input disabled:opacity-60" />
        </Field>
      </Card>

      <Card className="space-y-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Proof of residence</div>
        <p className="text-xs text-muted-foreground">Upload a utility bill, lease, or ID showing your address (PDF or image, max 8MB).</p>
        {docPath ? (
          <div className="flex items-center gap-2">
            <button onClick={viewDoc} className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium hover:bg-muted">View uploaded document</button>
            {!locked && <button onClick={() => fileRef.current?.click()} className="text-xs text-primary underline">Replace</button>}
          </div>
        ) : (
          <button
            disabled={locked || uploadDoc.isPending}
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-lg border border-dashed border-border bg-card px-4 py-3 text-xs font-medium hover:bg-muted disabled:opacity-60"
          >
            {uploadDoc.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            Upload document
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf,image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadDoc.mutate(f); e.target.value = ""; }}
        />
      </Card>

      {!locked && (
        <button
          onClick={() => submit.mutate()}
          disabled={submit.isPending}
          className="btn-primary w-full disabled:opacity-60"
        >
          {submit.isPending && <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />}
          {p?.verification_status === "rejected" ? "Resubmit for review" : "Submit for review"}
        </button>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</span>{children}</label>;
}
