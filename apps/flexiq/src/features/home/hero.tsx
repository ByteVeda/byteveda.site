"use client";

import { Button } from "@byteveda/ui";
import { useState } from "react";
import { Code } from "@/components/code";
import { HERO_PANES } from "@/content/hero";
import { HERO, PROCESS_LIST } from "@/content/pitch";
import { HeroField } from "@/features/hero-fx";
import { SDK_LABEL, SDKS, type Sdk, sdkDocsUrl } from "@/lib/docs";
import { LANG_FOR_SDK } from "@/lib/highlight";
import { site } from "@/lib/site";
import { useSdk } from "./sdk-context";

/** The two knobs named the way the reader's own SDK spells them. */
const KNOBS: Record<Sdk, [string, string]> = {
  python: ["max_retries", "rate_limit"],
  node: ["maxRetries", "rateLimit"],
  java: [".retries()", ".rateLimit()"],
};

/**
 * The claim, the code that backs it, and a process list.
 *
 * The process list is the argument in the one medium a backend developer
 * already trusts: `ps`. A fabricated `✓ add(2, 3) = 5` terminal proves nothing
 * — every project's landing page has one. Three struck-out daemons and one
 * surviving line is checkable against their own deployment.
 */
export function Hero() {
  const { sdk, setSdk } = useSdk();
  const [copied, setCopied] = useState(false);
  const pane = HERO_PANES.find((p) => p.sdk === sdk) ?? HERO_PANES[0];

  return (
    <section className="hero-m">
      <div className="mesh" aria-hidden>
        <b className="m1" />
        <b className="m2" />
      </div>
      <HeroField />

      <div className="wrap hero-grid">
        <div className="hero-copy">
          <h1 className="display hero-title">
            {HERO.headline} <span className="hero-accent">{HERO.headlineAccent}</span>
          </h1>
          <p className="hero-lede">{HERO.lede}</p>

          <div className="hero-cta">
            <Button
              href={sdkDocsUrl(sdk, "getting-started/quickstart")}
              variant="primary"
              arrow="→"
              external={false}
            >
              Start the quickstart
            </Button>
            <Button href="#lab" variant="ghost">
              Break it first
            </Button>
          </div>

          <div className="ps">
            <div className="ps-cmd">
              <span className="glyph">$</span> {PROCESS_LIST.command}
            </div>
            {PROCESS_LIST.gone.map((line) => (
              <div key={line} className="ps-gone ps-line">
                <s>{line}</s>
              </div>
            ))}
            <div className="ps-kept ps-line">
              <i aria-hidden />
              {PROCESS_LIST.kept}
            </div>
          </div>
        </div>

        <div className="hero-pane">
          <div className="pane">
            <div className="pane-bar">
              <span className="dots">
                <i />
                <i />
                <i />
              </span>
              <span>{pane.filename}</span>
              <a className="hero-repo" href={site.repoUrl} target="_blank" rel="noreferrer">
                source ↗
              </a>
            </div>

            <div className="hero-tabs">
              <div className="tabs">
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
                  navigator.clipboard?.writeText(pane.code);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1400);
                }}
              >
                {copied ? "Copied" : "Copy"}
              </button>
            </div>

            <Code code={pane.code} lang={LANG_FOR_SDK[pane.sdk]} />
          </div>

          <p className="hero-note">
            <b>{KNOBS[sdk][0]}</b> and <b>{KNOBS[sdk][1]}</b> are the two things that are hard to
            get right. They are one argument each here because the Rust scheduler enforces them
            across every worker — not your <code>try</code>/<code>except</code> block, and not a
            per-process counter that resets on deploy.
          </p>
        </div>
      </div>
    </section>
  );
}
