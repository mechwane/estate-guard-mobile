import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui-kit";
import { FadeIn } from "@/components/motion-kit";
import { ScrollText } from "lucide-react";

export const Route = createFileRoute("/app/resident/terms")({
  component: Terms,
});

function Terms() {
  return (
    <div className="space-y-4">
      <FadeIn>
        <div className="flex items-center gap-3">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ScrollText className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Terms & Conditions</h1>
            <p className="text-xs text-muted-foreground">Last updated: July 2026</p>
          </div>
        </div>
      </FadeIn>

      <FadeIn delay={0.05}>
        <Card className="space-y-4 p-5 text-sm leading-relaxed text-foreground">
          <p className="text-muted-foreground">
            These terms govern your use of the Estate Guard app. By creating an account or
            using the app you agree to them.
          </p>

          <Section title="1. Your account">
            <p>
              You must provide accurate information and keep your login secure. You are
              responsible for actions taken from your account, including visitor invites you
              create.
            </p>
          </Section>

          <Section title="2. Acceptable use">
            <ul className="list-inside list-disc space-y-1">
              <li>Do not use the app to harass, threaten or defraud other users.</li>
              <li>Do not submit false verification documents or fake resident details.</li>
              <li>Do not attempt to bypass gate security or share visitor codes publicly.</li>
            </ul>
          </Section>

          <Section title="3. Estate rules">
            <p>
              Each estate sets its own rules for entry, dues and shop items. Your estate admin
              may suspend or remove your access if you breach those rules.
            </p>
          </Section>

          <Section title="4. Payments">
            <p>
              Bills, dues and shop purchases are payable through the payment methods listed in
              the app. Refunds follow your estate's stated policy.
            </p>
          </Section>

          <Section title="5. Premium">
            <p>
              Premium is billed monthly or yearly and renews automatically until cancelled. You
              can cancel anytime from More → Estate Premium.
            </p>
          </Section>

          <Section title="6. Termination">
            <p>
              You may close your account at any time by contacting support. We may suspend
              accounts that breach these terms or that pose a security risk to the estate.
            </p>
          </Section>

          <Section title="7. Changes">
            <p>
              We may update these terms as the service evolves. Material changes will be
              announced in the app.
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
