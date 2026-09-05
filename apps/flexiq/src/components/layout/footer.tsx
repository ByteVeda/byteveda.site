import { ExternalLink } from "@byteveda/ui";
import Link from "next/link";
import { DocsLink } from "@/components/docs-link";
import { Wordmark } from "@/components/wordmark";
import { docsUrl, SDK_LABEL, SDKS } from "@/lib/docs";
import { site } from "@/lib/site";

const resources = [
  { label: "Documentation", href: docsUrl() },
  { label: "Architecture", href: docsUrl("architecture") },
  { label: "Changelog", href: docsUrl("about/changelog") },
  { label: "Comparison", href: docsUrl("about/comparison") },
];

export function Footer() {
  return (
    <footer className="footer">
      <div className="wrap footer-grid">
        <div className="footer-brand">
          <p className="brand">
            <Wordmark />
          </p>
          <p>{site.description}</p>
        </div>

        <div className="footer-col">
          <h3>Quickstarts</h3>
          {SDKS.map((sdk) => (
            <DocsLink key={sdk} href={docsUrl(`${sdk}/getting-started/quickstart`)}>
              {SDK_LABEL[sdk]}
            </DocsLink>
          ))}
        </div>

        <div className="footer-col">
          <h3>Resources</h3>
          {resources.map((item) => (
            <DocsLink key={item.href} href={item.href}>
              {item.label}
            </DocsLink>
          ))}
        </div>

        <div className="footer-col">
          <h3>Project</h3>
          <ExternalLink href={site.repoUrl}>GitHub</ExternalLink>
          <Link href="/blog">Blog</Link>
          <Link href="/playground">Playground</Link>
          <Link href={site.orgUrl}>{site.org}</Link>
        </div>
      </div>

      <div className="wrap footer-bottom">
        <span>
          MIT licensed · built by <Link href={site.orgUrl}>{site.org}</Link>
        </span>
      </div>
    </footer>
  );
}
