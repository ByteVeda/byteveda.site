import { ECOSYSTEM_LABELS } from "@byteveda/db";
import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import {
  AddPackageForm,
  CollectButton,
  RemovePackageButton,
  SeedButton,
} from "@/components/stats/package-controls";
import { Sparkline } from "@/components/stats/sparkline";
import { TrendChart } from "@/components/stats/trend-chart";
import { ago, count, delta } from "@/lib/format";
import { getStatsOverview, WINDOW_DAYS } from "@/lib/stats/queries";

export const metadata: Metadata = { title: "Downloads" };
export const dynamic = "force-dynamic";

/** Why a package has no numbers, said plainly rather than shown as a red dot. */
function note(status: string, recordedDays: number, detail: string | null): string | null {
  if (status === "unsupported") return detail ?? "Not published by this registry.";
  if (status === "failed") return detail ?? "Last collection failed.";
  if (status === "never") return "Not collected yet.";
  if (recordedDays === 0) return "No downloads recorded in this window.";
  return null;
}

export default async function StatsPage() {
  const { projects, daily, last30, previous30, lastRunAt, packageCount } = await getStatsOverview();

  const overall = delta(last30, previous30);

  return (
    <>
      <PageHeader title="Downloads" sub={lastRunAt ? `Collected ${ago(lastRunAt)} ago` : undefined}>
        {packageCount > 0 && <CollectButton />}
      </PageHeader>

      <div className="content content-narrow">
        {packageCount === 0 ? (
          <div className="empty">
            <h3>Nothing tracked yet</h3>
            <p>
              Add the packages from the project catalogue, then collect. You can correct any name
              afterwards.
            </p>
            <SeedButton />
          </div>
        ) : (
          <>
            <div className="stat-head">
              <b>{count(last30)}</b>
              <span className={`delta ${overall.tone}`}>{overall.label}</span>
            </div>
            <p className="stat-sub">
              downloads in the last {WINDOW_DAYS} days, against the {WINDOW_DAYS} before it
            </p>

            <TrendChart daily={daily} />

            <div className="tape">
              {projects.map((project) => {
                const projectDelta = delta(project.last30, project.previous30);

                return (
                  <section key={project.slug}>
                    <div className="tape-project">
                      <h3>{project.name}</h3>
                      <span className="num">{count(project.last30)}</span>
                      <span className={`num ${projectDelta.tone}`}>{projectDelta.label}</span>
                      <span />
                    </div>

                    {project.packages.map((pkg) => {
                      const packageDelta = delta(pkg.last30, pkg.previous30);
                      const problem = note(pkg.status, pkg.recordedDays, pkg.detail);

                      return (
                        <div key={pkg.packageId} className="tape-row">
                          <span className="tape-eco">{ECOSYSTEM_LABELS[pkg.ecosystem]}</span>
                          <span className="tape-name">
                            {pkg.packageName}
                            {problem && <span className="tape-note"> · {problem}</span>}
                          </span>

                          {problem ? (
                            <span className="spark-empty">—</span>
                          ) : (
                            <Sparkline
                              values={pkg.spark}
                              label={`${pkg.packageName} downloads over the last ${WINDOW_DAYS} days`}
                            />
                          )}

                          <span className="num">
                            {problem ? <span className="num-dim">—</span> : count(pkg.last30)}
                            {pkg.total !== null && (
                              <span className="row-sub" title={`Lifetime, via ${pkg.totalSource}`}>
                                {count(pkg.total)} all time
                              </span>
                            )}
                          </span>

                          <span className={`num ${packageDelta.tone}`}>
                            {problem ? "" : packageDelta.label}
                          </span>

                          <RemovePackageButton id={pkg.packageId} name={pkg.packageName} />
                        </div>
                      );
                    })}
                  </section>
                );
              })}
            </div>

            <AddPackageForm />
          </>
        )}
      </div>
    </>
  );
}
