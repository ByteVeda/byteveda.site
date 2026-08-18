import { ArrowRight, Badge, ExternalLink, GithubIcon, TerminalChip } from "@byteveda/ui";
import { cn, type Project } from "@byteveda/utils";
import Link from "next/link";

type Props = {
  tool: Project;
};

export function ToolCard({ tool }: Props) {
  const docsHref = `/${tool.slug}/`;

  return (
    <article className="group relative flex flex-col rounded-lg border border-border bg-background/40 p-6 transition-colors hover:border-foreground/30">
      <header className="flex items-start justify-between gap-4">
        <Link
          href={docsHref}
          className="font-mono font-semibold text-foreground text-lg transition-colors hover:text-accent"
        >
          {tool.name}
        </Link>
        {/* Archived upstream: the docs below are the last build, not a moving target. */}
        {tool.archived && <Badge>Archived</Badge>}
      </header>

      <p className="mt-3 text-foreground text-sm leading-6">{tool.tagline}</p>
      <p className="mt-2 text-muted-foreground text-sm leading-6">{tool.description}</p>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {tool.languages.map((lang) => (
          <Badge key={lang} variant="outline">
            {lang}
          </Badge>
        ))}
        <Badge variant="outline">{tool.license}</Badge>
      </div>

      <TerminalChip size="sm" block className="mt-5">
        {tool.install}
      </TerminalChip>

      <footer className="mt-5 flex items-center gap-4 border-border border-t pt-5">
        <Link
          href={docsHref}
          className={cn(
            "inline-flex items-center gap-1.5 font-medium text-xs",
            "text-foreground transition-colors hover:text-accent",
          )}
        >
          Read the docs
          <ArrowRight className="h-3 w-3" strokeWidth={2} />
        </Link>
        <ExternalLink
          href={tool.repoUrl}
          className="font-medium text-xs"
          icon={<GithubIcon size={14} />}
        >
          Repo
        </ExternalLink>
      </footer>
    </article>
  );
}
