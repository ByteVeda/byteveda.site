import { Marquee } from "@/components/ui";
import { getTrending } from "@/features/news";

const TRENDING_LIMIT = 12;

export function Trending() {
  const trending = getTrending(TRENDING_LIMIT);
  if (trending.length === 0) return null;

  return (
    <section className="section-pad" style={{ paddingBlock: "0 clamp(72px, 10vw, 150px)" }}>
      <div className="wrap">
        <div className="ticker-head">Trending on GitHub</div>
      </div>
      <div className="ticker">
        <Marquee
          items={trending}
          getKey={(item) => item.id}
          ariaLabel="Trending repositories on GitHub"
          renderItem={(item) => (
            <a className="ticker-item" href={item.url} target="_blank" rel="noopener noreferrer">
              <span className="star">★</span>
              <b>{item.title}</b>
              {item.score > 0 && <span className="n">{item.score.toLocaleString()}</span>}
            </a>
          )}
        />
      </div>
    </section>
  );
}
