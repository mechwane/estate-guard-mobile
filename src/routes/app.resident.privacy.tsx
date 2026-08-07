import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui-kit";
import { FadeIn } from "@/components/motion-kit";
import { Shield } from "lucide-react";

export const Route = createFileRoute("/app/resident/privacy")({
  component: Privacy,
});

function Privacy() {
  return (
    <div className="space-y-4">
      <FadeIn>
        <div className="flex items-center gap-3">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Privacy Policy</h1>
            <p className="text-xs text-muted-foreground">Last updated: July 2026</p>
          </div>
        </div>
      </FadeIn>

      <FadeIn delay={0.05}>
        <Card className="prose prose-sm max-w-none space-y-4 p-5 text-sm leading-relaxed text-foreground">
          <p className="text-muted-foreground">
            This page is maintained by the Estate Guard team. It describes how the app handles your
            information. It is not legal advice.
          </p>

          <Section title="Information we collect">
            <p>
              We collect the information you provide directly — your name, phone number, email,
              address details, dependents, IDs and any documents you upload for verification. We
              also collect activity data such as visitor invites, bill payments, service requests
              and support tickets.
            </p>
          </Section>

          <Section title="How we use your information">
            <ul className="list-inside list-disc space-y-1">
              <li>To operate the Estate Guard service and secure your estate.</li>
              <li>To verify residency and process visitor entries at the gate.</li>
              <li>To communicate with you about your account, bills and requests.</li>
              <li>To improve the app, fix bugs and prevent abuse.</li>
            </ul>
          </Section>

          <Section title="Who can see your information">
            <p>
              Your estate admins and assigned guards can see the information they need to run the
              estate — invites, bills, requests and verification status. Other residents cannot see
              your personal information. Payment providers process payments but do not receive your
              address code.
            </p>
          </Section>

          <Section title="Data retention">
            <p>
              We keep your account data for as long as your estate membership is active. When you
              leave an estate or delete your account, we remove personal data within 90 days except
              where retention is required by law.
            </p>
          </Section>

          <Section title="Your rights">
            <p>
              You can update your profile at any time under More → Edit Profile. To export or delete
              your data, contact support from the Support Tickets screen.
            </p>
          </Section>

          <Section title="Contact">
            <p>
              For privacy questions, open a support ticket or reach the estate contacts listed under
              More → Estate Contacts.
            </p>
          </Section>
        </Card>
      </FadeIn>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <div className="mt-1 text-muted-foreground">{children}</div>
    </div>
  );
}
