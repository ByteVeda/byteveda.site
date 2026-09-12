import { FileText, Gauge, Inbox, Send, Settings, TrendingUp } from "lucide-react";
import type { ComponentType, SVGProps } from "react";

export type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
};

/** Named because the rail badges this one link with the live unread count. */
export const INBOX_HREF = "/inbox";

export const nav: NavItem[] = [
  { href: "/", label: "Overview", icon: Gauge },
  { href: "/posts", label: "Posts", icon: FileText },
  { href: "/stats", label: "Downloads", icon: TrendingUp },
  { href: INBOX_HREF, label: "Inbox", icon: Inbox },
  { href: "/subscribers", label: "Subscribers", icon: Send },
  { href: "/settings", label: "Settings", icon: Settings },
];

/** `/posts` should stay lit while editing `/posts/<id>`; `/` only matches itself. */
export function isActive(href: string, pathname: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
