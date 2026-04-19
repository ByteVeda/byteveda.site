import { ExternalLink, Wordmark } from "@/components/ui";
import { projects } from "@/lib/projects";
import { site } from "@/lib/site";

export function Footer() {
  return (
    <footer className="mt-auto border-border border-t">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <Wordmark />
            <p className="mt-4 max-w-xs text-muted-foreground text-sm">
              Rust-powered libraries for serious systems.
            </p>
          </div>

          <FooterColumn title="Tools">
            {projects.map((p) => (
              <li key={p.slug}>
                <ExternalLink href={p.docsUrl ?? p.repoUrl} className="text-sm">
                  {p.name}
                </ExternalLink>
              </li>
            ))}
          </FooterColumn>

          <FooterColumn title="Resources">
            <li>
              <ExternalLink href={site.docsUrl} className="text-sm">
                Documentation
              </ExternalLink>
            </li>
            <li>
              <ExternalLink href={site.githubUrl} className="text-sm">
                GitHub organization
              </ExternalLink>
            </li>
          </FooterColumn>
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-3 border-border border-t pt-6 text-muted-foreground text-xs sm:flex-row sm:items-center">
          <p>
            © {new Date().getFullYear()} {site.name}. Released under MIT and Apache-2.0 licenses.
          </p>
          <p className="font-mono">{site.domain}</p>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="font-mono text-muted-foreground text-xs uppercase tracking-widest">{title}</h4>
      <ul className="mt-4 space-y-2">{children}</ul>
    </div>
  );
}
