"use client";

import type { PostSeo } from "@byteveda/db";
import { useMemo } from "react";
import { auditPost, auditScore, extractKeywords } from "@/lib/seo";

type Props = {
  title: string;
  description: string;
  slug: string;
  body: string;
  tags: string[];
  /** Other posts' bodies, for the relative part of the ranking. */
  corpus: string[];
  seo: PostSeo;
  onChange: (seo: PostSeo) => void;
};

export function SeoPanel({ title, description, slug, body, tags, corpus, seo, onChange }: Props) {
  const chosen = seo.keywords ?? [];
  // The first chosen keyword is the one the checks are run against.
  const primary = chosen[0];

  const candidates = useMemo(() => extractKeywords({ title, body, corpus }), [title, body, corpus]);

  const checks = useMemo(
    () => auditPost({ title, description, slug, body, tags, primaryKeyword: primary }),
    [title, description, slug, body, tags, primary],
  );

  const score = auditScore(checks);
  const best = candidates[0]?.score ?? 1;

  function toggle(term: string) {
    onChange({
      ...seo,
      keywords: chosen.includes(term)
        ? chosen.filter((keyword) => keyword !== term)
        : [...chosen, term],
    });
  }

  return (
    <>
      <div className="side-block">
        <div className="score">
          <b>{score}</b>
          <span>of 100</span>
        </div>
        <div className="score-track">
          <div className="score-fill" style={{ width: `${score}%` }} />
        </div>

        <div className="checks">
          {checks.map((check) => (
            <div key={check.id} className={`check check-${check.status}`}>
              <i className="check-mark" aria-hidden />
              <span>
                <b>{check.label}</b>
                <span>{check.detail}</span>
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="side-block">
        <h2>Keywords</h2>
        {candidates.length === 0 ? (
          <p style={{ color: "var(--text-faint)", fontSize: "0.78rem" }}>
            Write a few paragraphs and suggestions will appear here.
          </p>
        ) : (
          <>
            <p style={{ color: "var(--text-faint)", fontSize: "0.74rem", marginBottom: 8 }}>
              {primary ? `Checking against "${primary}".` : "Choose one to check the post against."}
            </p>
            {candidates.map((candidate) => (
              <button
                key={candidate.term}
                type="button"
                className="kw"
                data-chosen={chosen.includes(candidate.term)}
                onClick={() => toggle(candidate.term)}
                title={
                  candidate.inTitle
                    ? "Already in the title"
                    : candidate.inHeading
                      ? "Appears in a heading"
                      : `Used ${candidate.occurrences} times`
                }
              >
                <span className="kw-term">{candidate.term}</span>
                <span className="kw-bar">
                  <i style={{ width: `${Math.round((candidate.score / best) * 100)}%` }} />
                </span>
                <span className="kw-n">{candidate.occurrences}</span>
              </button>
            ))}
          </>
        )}
      </div>

      <div className="side-block">
        <h2>Search appearance</h2>
        <div className="field">
          <label htmlFor="seo-title">Title override</label>
          <input
            id="seo-title"
            className="input"
            value={seo.metaTitle ?? ""}
            onChange={(event) => onChange({ ...seo, metaTitle: event.target.value })}
            placeholder={title || "Uses the post title"}
          />
        </div>
        <div className="field">
          <label htmlFor="seo-description">Description override</label>
          <textarea
            id="seo-description"
            className="textarea"
            rows={3}
            value={seo.metaDescription ?? ""}
            onChange={(event) => onChange({ ...seo, metaDescription: event.target.value })}
            placeholder={description || "Uses the post description"}
          />
        </div>
      </div>
    </>
  );
}
