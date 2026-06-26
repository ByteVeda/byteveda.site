import { Button } from "@/components/ui";
import { getArticles, getReleases, NewsCard } from "@/features/news";
import { site } from "@/lib/site";

const RELEASE_LIMIT = 4;
const COMMUNITY_LIMIT = 4;

export function Feed() {
  const releases = getReleases(RELEASE_LIMIT);
  const community = getArticles(COMMUNITY_LIMIT);
  if (releases.length === 0 && community.length === 0) return null;

  return (
    <section className="section-pad" id="releases" style={{ paddingTop: 0 }}>
      <div className="wrap">
        <div className="sec-head reveal">
          <span className="marker">Activity</span>
          <h2>Shipping in the open.</h2>
          <p className="lede">
            Tagged builds straight from the org, and what the wider open-source ecosystem is talking
            about — refreshed every few hours.
          </p>
        </div>

        <div className="feed-cols">
          {releases.length > 0 && (
            <div className="feed-col reveal">
              <div className="feed-head">
                <h3>Recent releases</h3>
              </div>
              <div className="feed-grid">
                {releases.map((item) => (
                  <NewsCard key={item.id} item={item} />
                ))}
              </div>
              <div className="feed-more">
                <Button
                  href={`${site.githubUrl}?tab=repositories`}
                  variant="ghost"
                  arrow="→"
                  external
                >
                  All repositories
                </Button>
              </div>
            </div>
          )}

          {community.length > 0 && (
            <div className="feed-col reveal">
              <div className="feed-head">
                <h3>From the community</h3>
              </div>
              <div className="feed-grid">
                {community.map((item) => (
                  <NewsCard key={item.id} item={item} />
                ))}
              </div>
              <div className="feed-more">
                <Button href="/news" variant="ghost" arrow="→">
                  See all news
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
