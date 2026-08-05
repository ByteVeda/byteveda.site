import { GithubIcon, Wordmark } from "@/components/ui";
import { projects } from "@/lib/projects";
import { site } from "@/lib/site";
import { FooterSubscribe } from "./footer-subscribe";

const resources = [
  { label: "Documentation ↗", href: site.docsUrl },
  { label: "GitHub org ↗", href: site.githubUrl },
  { label: "News", href: "/news" },
  { label: "Contribute", href: "/contribute" },
];

const org = [
  { label: "About", href: "/#about" },
  { label: "Releases", href: "/#releases" },
  { label: "Contact", href: `mailto:hello@${site.domain}` },
];

export function Footer() {
  return (
    <footer className="footer">
      <div className="wrap">
        <div className="footer-cta">
          <div className="footer-cta-copy">
            <span className="marker">Stay in the loop</span>
            <h3>New releases, in your inbox.</h3>
            <p>
              Occasional notes when we ship something worth your time. No noise, unsubscribe
              anytime.
            </p>
          </div>
          <FooterSubscribe />
        </div>

        <hr className="hr" />

        <div className="footer-grid">
          <div className="footer-brand">
            <Wordmark href="/" />
            <p>
              High-performance libraries for serious systems. Native speed, in the language you
              already ship in.
            </p>
            <div className="footer-social">
              <a href={site.githubUrl} aria-label={`${site.name} on GitHub`}>
                <GithubIcon />
              </a>
            </div>
          </div>

          <FooterColumn title="Tools">
            {projects.map((p) => (
              <li key={p.slug}>
                <a href={p.docsUrl ?? p.repoUrl}>{p.name}</a>
              </li>
            ))}
          </FooterColumn>

          <FooterColumn title="Resources">
            {resources.map((r) => (
              <li key={r.href}>
                <a href={r.href}>{r.label}</a>
              </li>
            ))}
          </FooterColumn>

          <FooterColumn title="Org">
            {org.map((o) => (
              <li key={o.href}>
                <a href={o.href}>{o.label}</a>
              </li>
            ))}
          </FooterColumn>
        </div>

        <div className="footer-bottom">
          <span>
            © {new Date().getFullYear()} {site.name.toUpperCase()} — MIT / APACHE-2.0
          </span>
          <span>{site.domain}</span>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="footer-col">
      <h5>{title}</h5>
      <ul>{children}</ul>
    </div>
  );
}
