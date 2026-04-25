"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const NOTEBOOK_ROUTES = ["/news"];

function isNotebookPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return NOTEBOOK_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

export function NotebookFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (!isNotebookPath(pathname)) {
    return <>{children}</>;
  }
  return (
    <div className="notebook notebook-paper flex min-h-screen flex-1 flex-col bg-background text-foreground">
      {children}
    </div>
  );
}
