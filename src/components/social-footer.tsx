import { Facebook, Instagram, Linkedin, Twitter } from "lucide-react";

const LINKS = [
  {
    label: "Facebook",
    href: "https://facebook.com",
    icon: Facebook,
    className: "bg-[#1877F2] text-white",
  },
  {
    label: "Instagram",
    href: "https://instagram.com",
    icon: Instagram,
    className: "bg-gradient-to-br from-[#F58529] via-[#DD2A7B] to-[#8134AF] text-white",
  },
  {
    label: "LinkedIn",
    href: "https://linkedin.com",
    icon: Linkedin,
    className: "bg-[#0A66C2] text-white",
  },
  {
    label: "X (Twitter)",
    href: "https://x.com",
    icon: Twitter,
    className: "bg-foreground text-background",
  },
];

/** Social accounts + app version footer, shown at the bottom of the More hubs. */
export function SocialFooter({ version = "1.0.0" }: { version?: string }) {
  return (
    <div className="pb-2 pt-1">
      <div className="flex items-center justify-center gap-4">
        {LINKS.map(({ label, href, icon: Icon, className }) => (
          <a
            key={label}
            href={href}
            target="_blank"
            rel="noreferrer noopener"
            aria-label={label}
            className={`inline-flex h-10 w-10 items-center justify-center rounded-full shadow-sm transition-transform hover:scale-110 active:scale-95 ${className}`}
          >
            <Icon className="h-5 w-5" />
          </a>
        ))}
      </div>
      <p className="mt-3 text-center text-[11px] leading-relaxed text-muted-foreground">
        Estate Guard
        <br />
        Version {version}
      </p>
    </div>
  );
}
