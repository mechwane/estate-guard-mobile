import { createFileRoute, Link } from "@tanstack/react-router";
import { Smartphone, Wifi, Zap, Tv, ScrollText, ArrowRight } from "lucide-react";
import { Card, SectionTitle } from "@/components/ui-kit";

export const Route = createFileRoute("/app/resident/vtu/")({
  component: VtuHub,
});

const SERVICES = [
  { key: "airtime", label: "Airtime", desc: "Top up any Nigerian line", icon: Smartphone },
  { key: "data", label: "Data", desc: "Mobile data bundles", icon: Wifi },
  { key: "electricity", label: "Electricity", desc: "Prepaid & postpaid meters", icon: Zap },
  { key: "cable", label: "Cable TV", desc: "DStv, GOtv, Startimes", icon: Tv },
] as const;

function VtuHub() {
  return (
    <div className="space-y-4">
      <Card>
        <p className="text-sm text-muted-foreground">
          Pay bills and top up services securely. Every transaction has a receipt and appears in your history.
        </p>
      </Card>
      <SectionTitle
        action={
          <Link to="/app/resident/vtu/history" className="inline-flex items-center gap-1 text-xs font-medium text-primary">
            <ScrollText className="h-3.5 w-3.5" /> History
          </Link>
        }
      >
        Services
      </SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        {SERVICES.map((s) => (
          <Link
            key={s.key}
            to="/app/resident/vtu/$service"
            params={{ service: s.key }}
            className="card-surface group flex flex-col gap-2 p-4 transition-colors hover:border-primary/50"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <s.icon className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">{s.label}</h3>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary" />
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">{s.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
