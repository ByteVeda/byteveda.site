"use client";

import { Button } from "@byteveda/ui";
import { useState } from "react";
import { SDK_LABEL, SDKS, sdkDocsUrl } from "@/lib/docs";
import { installCommands } from "@/lib/version";
import { useSdk } from "./sdk-context";

function InstallPill({ command, shell }: { command: string; shell: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="install">
      {shell && <span className="install-prompt">$</span>}
      <code>{command}</code>
      <button
        type="button"
        className="pg-copy"
        aria-label={`Copy ${command}`}
        onClick={() => {
          navigator.clipboard?.writeText(command);
          setCopied(true);
          setTimeout(() => setCopied(false), 1400);
        }}
      >
        {copied ? "✓" : "Copy"}
      </button>
    </div>
  );
}

export function Cta({ version }: { version: string }) {
  const { sdk } = useSdk();
  const commands = installCommands(version);

  return (
    <section className="section-pad" id="get-started">
      <div className="wrap cta-m">
        <p className="kicker">Get started</p>
        <h2 className="display">Five minutes from install to your first job.</h2>
        <p>
          Define a task, enqueue it, watch a worker run it — in the language you already use. No
          broker, no second daemon, no configuration file.
        </p>

        <div className="install-row">
          {SDKS.map((item) => (
            <InstallPill key={item} command={commands[item]} shell={item !== "java"} />
          ))}
        </div>

        <div className="hero-cta">
          <Button
            href={sdkDocsUrl(sdk, "getting-started/quickstart")}
            variant="primary"
            arrow="→"
            external={false}
          >
            {SDK_LABEL[sdk]} quickstart
          </Button>
          <Button href="/playground" variant="ghost" arrow="→">
            Open the playground
          </Button>
        </div>
      </div>
    </section>
  );
}
