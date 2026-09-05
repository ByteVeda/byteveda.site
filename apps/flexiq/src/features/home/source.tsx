import { ExternalLink } from "@byteveda/ui";
import { Code } from "@/components/code";
import { DocsLink } from "@/components/docs-link";
import { SOURCE } from "@/content/pitch";
import { docsUrl } from "@/lib/docs";
import { site } from "@/lib/site";
import { Reveal } from "./reveal";

/**
 * The transparency section.
 *
 * FlexiQ has no adoption numbers to lean on, and a logo wall or a star count
 * at this stage would read as padding. What it does have is a repository, so
 * the argument here is the engineering itself: one claim, the API that
 * expresses it, and the function that implements it, quoted rather than
 * paraphrased. A reader who wants to check whether the retry story is real can
 * do it without cloning anything.
 */
export function Source() {
  return (
    <section className="section-pad section-soft" id="source">
      <div className="wrap">
        <div className="section-head">
          <p className="kicker">Read the source</p>
          <h2>The retry curve, quoted rather than described.</h2>
          <p>
            <b>{SOURCE.claim}</b> Retry behaviour is where task queues quietly differ, and where a
            landing page is cheapest to lie on — so here is the function itself. Full Jitter draws
            the whole delay from <code>[0, cap]</code> rather than adding a fixed wobble to a fixed
            backoff, and that is what actually spreads a stampede: the spread grows with the cap
            instead of staying one jitter wide.
          </p>
        </div>

        <Reveal>
          <div className="source">
            <div className="source-col">
              <p className="source-role">What you write</p>
              <div className="pane">
                <div className="pane-bar">
                  <span className="dots">
                    <i />
                    <i />
                    <i />
                  </span>
                  <span>tasks.py</span>
                </div>
                <Code code={SOURCE.api} lang="python" />
              </div>
            </div>

            <div className="source-col">
              <p className="source-role">What runs</p>
              <div className="pane">
                <div className="pane-bar">
                  <span className="dots">
                    <i />
                    <i />
                    <i />
                  </span>
                  <span>{SOURCE.path}</span>
                  <ExternalLink
                    className="hero-repo"
                    href={`${site.repoUrl}/blob/main/${SOURCE.permalink}`}
                  >
                    open ↗
                  </ExternalLink>
                </div>
                <Code code={SOURCE.rust} lang="rust" />
              </div>
            </div>
          </div>
        </Reveal>

        <p className="ledger-foot">
          MIT licensed, and the{" "}
          <DocsLink href={docsUrl("architecture/failure-model")}>failure model</DocsLink> is written
          down — what happens when a worker is killed, when storage is unreachable, and when a task
          blows its soft timeout — rather than left to be discovered in production.
        </p>
      </div>
    </section>
  );
}
