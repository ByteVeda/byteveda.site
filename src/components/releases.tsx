import { getReleases } from "@/lib/news";
import { site } from "@/lib/site";
import { FeedSection } from "./feed-section";

type ReleasesProps = {
  limit?: number;
};

export function Releases({ limit = 3 }: ReleasesProps) {
  const items = getReleases(limit);
  return (
    <FeedSection
      id="releases"
      eyebrow="Releases"
      title="Recent releases"
      description="Latest tagged releases from the ByteVeda GitHub organization."
      items={items}
      viewAll={{ href: `${site.githubUrl}?tab=repositories`, label: "All repositories on GitHub" }}
    />
  );
}
