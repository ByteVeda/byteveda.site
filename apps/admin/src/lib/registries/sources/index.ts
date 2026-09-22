import type { Ecosystem } from "@byteveda/db";
import type { Adapter } from "../types";
import { crates } from "./crates";
import { maven } from "./maven";
import { npm } from "./npm";
import { pypi } from "./pypi";

export const adapters: Record<Ecosystem, Adapter> = { pypi, npm, crates, maven };

export function adapterFor(ecosystem: Ecosystem): Adapter {
  return adapters[ecosystem];
}

export { crates, maven, npm, pypi };
