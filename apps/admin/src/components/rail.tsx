"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Mark } from "@/components/mark";
import { isActive, nav } from "@/lib/nav";

type Props = {
  user: { login: string; name: string | null; avatarUrl: string | null };
  /** Unread counts keyed by href, shown against the matching link. */
  counts?: Record<string, number>;
  children?: React.ReactNode;
};

export function Rail({ user, counts, children }: Props) {
  const pathname = usePathname();

  return (
    <nav className="rail" aria-label="Admin sections">
      <Link href="/" className="rail-brand">
        <span className="mark">
          <Mark size={14} />
        </span>
        <span>
          byteveda <small>admin</small>
        </span>
      </Link>

      <div className="rail-nav">
        {nav.map(({ href, label, icon: Icon }) => {
          const count = counts?.[href];
          return (
            <Link
              key={href}
              href={href}
              className="rail-link"
              aria-current={isActive(href, pathname) ? "page" : undefined}
            >
              <Icon aria-hidden />
              {label}
              {count ? <span className="count">{count}</span> : null}
            </Link>
          );
        })}
      </div>

      <div className="rail-spacer" />

      <div className="rail-foot">
        {/* A GitHub CDN URL that redirects; next/image would mean remotePatterns
            upkeep for one 24px image sitting behind a login. */}
        {user.avatarUrl ? <img src={user.avatarUrl} alt="" width={24} height={24} /> : null}
        <span className="who">
          <b className="who-name">{user.name ?? user.login}</b>
          <span className="who-handle">@{user.login}</span>
        </span>
        {children}
      </div>
    </nav>
  );
}
