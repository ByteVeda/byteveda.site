"use client";

// From /constants, not the package root: importing any *value* from the root
// pulls the pooled client — and `pg` — into the browser bundle.
import { ECOSYSTEM_LABELS, ECOSYSTEMS, type Ecosystem } from "@byteveda/db/constants";
import { projects } from "@byteveda/utils";
import { Plus, RefreshCw, X } from "lucide-react";
import { useState, useTransition } from "react";
import { useConfirm } from "@/components";
import { addPackage, collectNow, removePackage, seedFromCatalogue } from "@/lib/stats/actions";
import { adapterHints } from "@/lib/stats/hints";

type Message = { text: string; ok: boolean } | null;

export function CollectButton({ onMessage }: { onMessage?: (message: Message) => void }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<Message>(null);

  return (
    <>
      {message && (
        <span className="save-state" data-tone={message.ok ? "ok" : "error"}>
          {message.text}
        </span>
      )}
      <button
        type="button"
        className="abtn abtn-quiet"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await collectNow();
            setMessage({ text: result.message, ok: result.ok });
            onMessage?.({ text: result.message, ok: result.ok });
          })
        }
      >
        <RefreshCw aria-hidden />
        {pending ? "Collecting…" : "Collect now"}
      </button>
    </>
  );
}

export function SeedButton() {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<Message>(null);

  return (
    <>
      <button
        type="button"
        className="abtn abtn-primary"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await seedFromCatalogue();
            setMessage({ text: result.message, ok: result.ok });
          })
        }
      >
        <Plus aria-hidden />
        {pending ? "Adding…" : "Add from the catalogue"}
      </button>
      {message && (
        <p className="note" data-tone="idle">
          {message.text}
        </p>
      )}
    </>
  );
}

export function RemovePackageButton({ id, name }: { id: string; name: string }) {
  const [pending, startTransition] = useTransition();
  const confirm = useConfirm();

  return (
    <button
      type="button"
      className="tape-remove"
      aria-label={`Stop tracking ${name}`}
      title={`Stop tracking ${name}`}
      disabled={pending}
      onClick={async () => {
        const go = await confirm({
          title: `Stop tracking ${name}?`,
          body: "Its recorded download history is removed with it.",
          confirmLabel: "Stop tracking",
          destructive: true,
        });
        if (!go) return;
        startTransition(() => removePackage(id).then(() => undefined));
      }}
    >
      <X width={13} height={13} aria-hidden />
    </button>
  );
}

export function AddPackageForm() {
  const [projectSlug, setProjectSlug] = useState(projects[0]?.slug ?? "");
  const [ecosystem, setEcosystem] = useState<Ecosystem>(ECOSYSTEMS[0]);
  const [packageName, setPackageName] = useState("");
  const [message, setMessage] = useState<Message>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const result = await addPackage({ projectSlug, ecosystem, packageName });
      setMessage({ text: result.message, ok: result.ok });
      if (result.ok) setPackageName("");
    });
  }

  return (
    <>
      <div className="form-row form-row-packages">
        <div className="field">
          <label htmlFor="add-project">Project</label>
          <select
            id="add-project"
            className="select"
            value={projectSlug}
            onChange={(event) => setProjectSlug(event.target.value)}
          >
            {projects.map((project) => (
              <option key={project.slug} value={project.slug}>
                {project.name}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="add-ecosystem">Registry</label>
          <select
            id="add-ecosystem"
            className="select"
            value={ecosystem}
            // Options are generated from ECOSYSTEMS, so the value is always one of them.
            onChange={(event) => setEcosystem(event.target.value as Ecosystem)}
          >
            {ECOSYSTEMS.map((value) => (
              <option key={value} value={value}>
                {ECOSYSTEM_LABELS[value]}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="add-name">Package</label>
          <input
            id="add-name"
            className="input input-mono"
            value={packageName}
            onChange={(event) => setPackageName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") submit();
            }}
            placeholder={adapterHints[ecosystem]}
          />
        </div>

        <button
          type="button"
          className="abtn abtn-quiet"
          onClick={submit}
          disabled={pending || !packageName.trim()}
        >
          {pending ? "Checking…" : "Track"}
        </button>
      </div>

      {message && (
        <p className="note" data-tone={message.ok ? "ok" : "error"}>
          {message.text}
        </p>
      )}
    </>
  );
}
