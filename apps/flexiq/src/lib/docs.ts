import { site } from "./site";

export type Sdk = "python" | "node" | "java";

export const SDKS: readonly Sdk[] = ["python", "node", "java"] as const;

export const SDK_LABEL: Record<Sdk, string> = {
  python: "Python",
  node: "Node.js",
  java: "Java",
};

/**
 * Every documentation link goes through here, so the day the docs move to a
 * different host or base path it is one edit rather than a grep across sections.
 */
export function docsUrl(path = ""): string {
  const clean = path.replace(/^\/+/, "");
  return clean ? `${site.docsUrl}/${clean}` : site.docsUrl;
}

export function sdkDocsUrl(sdk: Sdk, path: string): string {
  return docsUrl(`${sdk}/${path.replace(/^\/+/, "")}`);
}
