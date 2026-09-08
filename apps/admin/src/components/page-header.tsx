type Props = {
  title: string;
  /** Short context for the title — a count, a slug, a last-updated time. */
  sub?: string;
  children?: React.ReactNode;
};

export function PageHeader({ title, sub, children }: Props) {
  return (
    <header className="topbar">
      <h1>{title}</h1>
      {sub ? <span className="sub">{sub}</span> : null}
      {children ? <div className="topbar-actions">{children}</div> : null}
    </header>
  );
}
