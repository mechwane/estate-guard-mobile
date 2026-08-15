import { FAQ_ITEMS } from "@/lib/faq-items";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card } from "@/components/ui-kit";
import { FadeIn, Stagger, StaggerItem } from "@/components/motion-kit";
import { ChevronDown, HelpCircle, Search } from "lucide-react";

export const Route = createFileRoute("/app/resident/faqs")({
  component: FAQs,
  head: () => ({
    meta: [
      { title: "Frequently Asked Questions — Estate Guard" },
      {
        name: "description",
        content:
          "Answers to common questions about invites, dependents, verification, bills, and premium features on Estate Guard.",
      },
      { property: "og:title", content: "Frequently Asked Questions — Estate Guard" },
      {
        property: "og:description",
        content: "Answers to common questions about Estate Guard for residents.",
      },
      { property: "og:url", content: "https://guard-estate-flow.lovable.app/app/resident/faqs" },
    ],
    links: [{ rel: "canonical", href: "https://guard-estate-flow.lovable.app/app/resident/faqs" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: FAQ_ITEMS.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        }),
      },
    ],
  }),
});


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
