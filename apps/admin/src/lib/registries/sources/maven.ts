import type { Adapter, FetchResult } from "../types";

/**
 * Maven Central publishes no download numbers.
 *
 * Sonatype's statistics are behind an authenticated per-namespace endpoint that
 * is not available to consumers of the repository, and there is no public
 * equivalent of pypistats or the npm downloads API. Rather than invent a
 * number or leave a row permanently red, the adapter says so — the collector
 * records `unsupported`, and the dashboard prints "not published" instead of a
 * count.
 *
 * If a Sonatype token is ever wired up, this is the only file that changes.
 */
export const maven: Adapter = {
  ecosystem: "maven",
  label: "Maven Central",
  hint: "groupId:artifactId — for example, org.byteveda.agenteval:agenteval-junit5",

  async fetch(): Promise<FetchResult> {
    return {
      kind: "unsupported",
      detail: "Maven Central does not publish download counts.",
    };
  },
};
