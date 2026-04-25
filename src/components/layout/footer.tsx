import { ExternalLink, Wordmark } from "@/components/ui";
import { projects } from "@/lib/projects";
import { site } from "@/lib/site";

export function Footer() {
  return (
    <footer className="mt-auto border-border border-t">
      <div className="mx-auto max-w-5xl px-6 py-14 md:px-10">
        <div className="grid gap-12 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <Wordmark />
            <p className="notebook-serif mt-4 max-w-xs text-[15px] text-muted-foreground italic leading-7">
              Rust-powered libraries for serious systems.
            </p>
          </div>

          <FooterColumn title="Tools">
            {projects.map((p) => (
              <li key={p.slug}>
                <ExternalLink href={p.docsUrl ?? p.repoUrl} className="notebook-serif text-[15px]">
                  {p.name}
                </ExternalLink>
              </li>
            ))}
          </FooterColumn>

          <FooterColumn title="Resources">
            <li>
              <ExternalLink href={site.docsUrl} className="notebook-serif text-[15px]">
                Documentation
              </ExternalLink>
            </li>
            <li>
              <ExternalLink href={site.githubUrl} className="notebook-serif text-[15px]">
                GitHub organization
              </ExternalLink>
            </li>
          </FooterColumn>
        </div>

        <div className="notebook-mono mt-12 flex flex-col items-start justify-between gap-3 border-border border-t pt-6 text-[10px] text-muted-foreground tracking-[0.18em] sm:flex-row sm:items-center">
          <p>
            © {new Date().getFullYear()} {site.name.toUpperCase()} — MIT / APACHE-2.0
          </p>
          <p>{site.domain}</p>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="notebook-smallcaps text-[13px] text-foreground">{title}</h4>
      <ul className="mt-4 space-y-2">{children}</ul>
    </div>
  );
}
