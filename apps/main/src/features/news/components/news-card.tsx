import { RelativeTime } from "@/components/ui";
import type { NewsItem } from "../types";
import { sourceLabel } from "../utils";

/**
 * Shared `.feed-item` card for a news/release item. Used by the homepage feed
 * and the `/news` catalog grid so both stay visually identical.
 */
export function NewsCard({ item }: { item: NewsItem }) {
  return (
    <a className="feed-item" href={item.url} target="_blank" rel="noopener noreferrer">
      <div className="row">
        <span className="src">{sourceLabel(item.source)}</span>
        {item.author && (
          <>
            <span aria-hidden>·</span>
            <span>{item.author}</span>
          </>
        )}
        <span aria-hidden>·</span>
        <RelativeTime value={item.publishedAt} />
        {item.labels.map((label) => (
          <span key={label} className={label === "rust" ? "lang rust" : "lang"}>
            {label}
          </span>
        ))}
      </div>
      <h4>{item.title}</h4>
      {item.excerpt && <p>{item.excerpt}</p>}
      <div className="row">
        <span className="arrow">read →</span>
      </div>
    </a>
  );
}
