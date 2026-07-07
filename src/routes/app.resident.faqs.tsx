import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card } from "@/components/ui-kit";
import { FadeIn, Stagger, StaggerItem } from "@/components/motion-kit";
import { ChevronDown, HelpCircle, Search } from "lucide-react";

export const Route = createFileRoute("/app/resident/faqs")({
  component: FAQs,
});

const FAQ_ITEMS = [
  {
    q: "How do I invite a visitor?",
    a: "Open Home, tap Single or Multiple Invite, fill in your visitor's details and send. Your visitor receives a unique code to show at the gate.",
  },
  {
    q: "How does the address code work?",
    a: "Your address code identifies your unit at the gate and on deliveries. You'll find it under Bills → Address Code. You can copy or share it anytime.",
  },
  {
    q: "How do I add a dependent?",
    a: "Go to More → Dependents → Add dependent. Dependents share your estate access without needing their own account.",
  },
  {
    q: "How do I get verified?",
    a: "Open More → Estate Verification, upload the requested document, and submit. Your estate admin reviews within 24-72 hours.",
  },
  {
    q: "What does Premium unlock?",
    a: "Priority handling on service requests, faster support, unlimited dependents & IDs, and a premium community badge.",
  },
  {
    q: "How do I pay my estate dues?",
    a: "Open Bills, choose the outstanding due and follow the payment flow. Receipts appear immediately after successful payment.",
  },
  {
    q: "Where do I report an issue?",
    a: "From Home tap 'Report an issue', or use Submit a Request under quick actions. You can also open a Support Ticket from More.",
  },
  {
    q: "How do I contact estate staff?",
    a: "More → Estate Contacts shows the numbers and emails your estate admin has published.",
  },
];

function FAQs() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<number | null>(0);

  const filtered = FAQ_ITEMS.filter(
    (f) =>
      !query ||
      f.q.toLowerCase().includes(query.toLowerCase()) ||
      f.a.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="space-y-4">
      <FadeIn>
        <div>
          <h1 className="text-xl font-semibold text-foreground">FAQs</h1>
          <p className="text-xs text-muted-foreground">Answers to common questions</p>
        </div>
      </FadeIn>

      <FadeIn delay={0.05}>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search FAQs"
            className="w-full rounded-lg border border-border bg-card py-2.5 pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </FadeIn>

      {filtered.length === 0 ? (
        <FadeIn>
          <Card className="flex flex-col items-center gap-2 p-8 text-center">
            <HelpCircle className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No FAQ matches your search.</p>
          </Card>
        </FadeIn>
      ) : (
        <Stagger className="space-y-2">
          {filtered.map((item, i) => {
            const isOpen = open === i;
            return (
              <StaggerItem key={item.q}>
                <Card className="overflow-hidden p-0">
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? null : i)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
                  >
                    <span className="text-sm font-medium text-foreground">{item.q}</span>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                        isOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  <div
                    className={`grid transition-[grid-template-rows] duration-300 ease-out ${
                      isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                    }`}
                  >
                    <div className="overflow-hidden">
                      <p className="px-4 pb-4 text-sm leading-relaxed text-muted-foreground">
                        {item.a}
                      </p>
                    </div>
                  </div>
                </Card>
              </StaggerItem>
            );
          })}
        </Stagger>
      )}
    </div>
  );
}
