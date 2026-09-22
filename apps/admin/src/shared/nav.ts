import { FileText, Gauge, Inbox, Send, Settings, TrendingUp, Users } from "lucide-react";
import type { ComponentType, SVGProps } from "react";
import { type AccessSnapshot, can, type Permission } from "@/lib/auth/roles";

export type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  /**
   * What the role has to carry for this to appear. Absent means everybody who
   * is signed in — the overview, which is gated card by card instead.
   *
   * The link disappearing is presentation, not protection: the page itself
   * calls `requirePermission`, and a typed URL lands on the overview with an
   * explanation. See `lib/auth/session.ts`.
   */
  permission?: Permission;
};

/** Named because the rail badges this one link with the live unread count. */
export const INBOX_HREF = "/inbox";

export const nav: NavItem[] = [
  { href: "/", label: "Overview", icon: Gauge },
  { href: "/posts", label: "Posts", icon: FileText, permission: "posts.read" },
  { href: "/stats", label: "Downloads", icon: TrendingUp, permission: "stats.read" },
  { href: INBOX_HREF, label: "Inbox", icon: Inbox, permission: "mail.read" },
  { href: "/subscribers", label: "Subscribers", icon: Send, permission: "subscribers.read" },
  { href: "/members", label: "Members", icon: Users, permission: "members.read" },
  { href: "/settings", label: "Settings", icon: Settings, permission: "settings.read" },
];

/** The rail this operator gets. */
export function navFor(access: AccessSnapshot): NavItem[] {
  return nav.filter((item) => !item.permission || can(access, item.permission));
}

/** `/posts` should stay lit while editing `/posts/<id>`; `/` only matches itself. */
export function isActive(href: string, pathname: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
