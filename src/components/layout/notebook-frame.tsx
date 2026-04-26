import type { ReactNode } from "react";

export function NotebookFrame({ children }: { children: ReactNode }) {
  return (
    <div className="notebook notebook-paper flex min-h-screen flex-1 flex-col bg-background text-foreground">
      {children}
    </div>
  );
}
