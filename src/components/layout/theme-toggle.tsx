"use client";

import { useTheme } from "next-themes";
import { Button, Moon, Sun } from "@/components/ui";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <Button
      variant="secondary"
      size="icon"
      aria-label="Toggle theme"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      <Sun className="hidden h-4 w-4 dark:block" strokeWidth={1.75} />
      <Moon className="block h-4 w-4 dark:hidden" strokeWidth={1.75} />
    </Button>
  );
}
