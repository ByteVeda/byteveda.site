"use client";

import { ThemeToggle } from "@byteveda/ui";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { roleLabel } from "@/features/auth/model";
// Relative, not through the barrel: this file is one of the things the barrel
// exports, and a module cannot be its own dependency.
import { useAccess } from "./access";
import { useInboxUnread } from "./inbox-live";
import { Mark } from "./mark";
import { INBOX_HREF, isActive, navFor } from "./nav";

type Props = {
  user: { login: string; name: string | null; avatarUrl: string | null };
  children?: React.ReactNode;
};

export function Rail({ user, children }: Props) {
  const pathname = usePathname();
  const access = useAccess();
  // Only the sections this operator can actually open. The page behind each one
  // checks for itself; this is so the rail is not a list of closed doors.
  const nav = navFor(access);
  // The one live figure in the rail. Mail arrives without anyone asking, so the
  // badge comes from the console's event stream rather than from this render.
  const unread = useInboxUnread();

  return (
    <nav className="rail" aria-label="Admin sections">
      <Link href="/" className="rail-brand">
        <span className="mark">
          <Mark size={22} />
        </span>
        <span>
          byteveda <small>admin</small>
        </span>
      </Link>

      <div className="rail-nav">
        {nav.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="rail-link"
            aria-current={isActive(href, pathname) ? "page" : undefined}
          >
            <Icon aria-hidden />
            {label}
            {href === INBOX_HREF && unread > 0 ? (
              <span className="count">
                {unread}
                <span className="sr-only"> unread</span>
              </span>
            ) : null}
          </Link>
        ))}
      </div>

      <div className="rail-spacer" />

      <div className="rail-foot">
        {/* A GitHub CDN URL that redirects; next/image would mean remotePatterns
            upkeep for one 24px image sitting behind a login. */}
        {user.avatarUrl ? <img src={user.avatarUrl} alt="" width={24} height={24} /> : null}
        <span className="who">
          <b className="who-name">{user.name ?? user.login}</b>
          {/* The role, not the handle. Which console you are looking at is
              obvious; what you are allowed to do in it is not, and it is the
              answer to every "why can I not see X". */}
          <span className="who-handle">{roleLabel(access)}</span>
        </span>
        <div className="rail-actions">
          <ThemeToggle />
          {children}
        </div>
      </div>
    </nav>
  );
}
