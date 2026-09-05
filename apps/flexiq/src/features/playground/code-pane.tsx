"use client";

import type { EngineConfig } from "@byteveda/flexiq-sim";
import { useState } from "react";
import { Code } from "@/components/code";
import { SDK_LABEL, SDKS, type Sdk } from "@/lib/docs";
import { LANG_FOR_SDK } from "@/lib/highlight";
import { CODE_FILENAME, renderCode } from "./code";

/**
 * The conversion moment: whatever the visitor just tuned, spelled as code they
 * can paste. It re-renders from the same config the simulation runs on, so the
 * snippet and the animation can never disagree.
 */
export function CodePane({ config }: { config: EngineConfig }) {
  const [sdk, setSdk] = useState<Sdk>("python");
  const [copied, setCopied] = useState(false);
  const code = renderCode(config, sdk);

  return (
    <div className="pane pg-code">
      <div className="pane-bar">
        <span className="dots">
          <i />
          <i />
          <i />
        </span>
        <span>{CODE_FILENAME[sdk]}</span>
        <div className="tabs pg-code-tabs">
          {SDKS.map((item) => (
            <button
              key={item}
              type="button"
              className="tab"
              aria-pressed={item === sdk}
              onClick={() => setSdk(item)}
            >
              {SDK_LABEL[item]}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="pg-copy"
          onClick={() => {
            navigator.clipboard?.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1400);
          }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <Code code={code} lang={LANG_FOR_SDK[sdk]} />
    </div>
  );
}
