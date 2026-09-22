import { Code } from "@/components/code";
import { DocsLink } from "@/components/docs-link";
import { INTEROP } from "@/content/pitch";
import { docsUrl } from "@/lib/docs";
import { Reveal } from "./reveal";

/**
 * The claim that is genuinely unusual, and therefore the one worth its own
 * section: the SDKs are peers over one store, not a reference implementation
 * plus two ports. A Node API route enqueues, a Python worker runs it, and the
 * handshake is a file — no HTTP hop, no serialisation contract to maintain,
 * and no rewrite of the pipeline in the language your web tier happens to use.
 */
export function Interop() {
  return (
    <section className="section-pad" id="interop">
      <div className="wrap">
        <div className="section-head">
          <p className="kicker">One store, three runtimes</p>
          <h2>
            Enqueue in Node. Run the worker in Python. Nobody rewrites the model pipeline in
            TypeScript.
          </h2>
          <p>
            Python, Node and Java bind to the same Rust core and the same table layout, so which
            runtime enqueues a job and which one executes it are separate decisions. Your API stays
            where your API is good; the work goes where the libraries are.
          </p>
        </div>

        <Reveal>
          <div className="interop">
            {INTEROP.files.map((file) => (
              <div key={file.filename} className="interop-file">
                <p className="interop-role">{file.role}</p>
                <div className="pane">
                  <div className="pane-bar">
                    <span className="dots">
                      <i />
                      <i />
                      <i />
                    </span>
                    <span>{file.filename}</span>
                  </div>
                  <Code code={file.code} lang={file.lang} />
                </div>
              </div>
            ))}
          </div>

          <div className="interop-store">
            <span className="interop-pipe" aria-hidden />
            <div className="interop-db">
              <b>{INTEROP.store}</b>
              <span>jobs · results · schedules · rate limit state</span>
            </div>
          </div>
        </Reveal>

        <p className="ledger-foot">
          <DocsLink href={docsUrl("architecture/storage")}>The storage layout</DocsLink> is
          documented rather than internal, because two runtimes sharing a table is only a feature if
          the shape of that table is a promise.
        </p>
      </div>
    </section>
  );
}
