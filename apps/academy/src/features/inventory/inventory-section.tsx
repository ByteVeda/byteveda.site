"use client";

import { useId, useMemo, useState } from "react";

import { Field, Segmented, TextInput } from "@/components/ui";
import { SampleBar } from "@/features/sample/sample-bar";
import { useSamples } from "@/features/sample/store";
import {
  type Board,
  type ChapterFilter,
  type ClassLevel,
  describeChapter,
  describeContents,
  listChapters,
  NO_FILTER,
  subjects,
} from "@/lib/inventory";

/** Six rows is about a screen; the rest is one click away. */
const PAGE = 6;

const BOARDS = [
  { value: "All", label: "All" },
  { value: "CBSE", label: "CBSE" },
  { value: "ICSE", label: "ICSE" },
] as const satisfies readonly { value: Board | "All"; label: string }[];

const CLASSES = [
  { value: "All", label: "All" },
  { value: "9", label: "Class 9" },
  { value: "10", label: "Class 10" },
] as const satisfies readonly { value: ClassLevel | "All"; label: string }[];

const SUBJECTS = [
  { value: "All", label: "All subjects" },
  ...subjects.map((subject) => ({ value: subject, label: subject })),
];

/**
 * The counter.
 *
 * A table rather than a grid of cards: what someone is doing here is looking
 * up one chapter they already have a name for, comparing what is in it, and
 * adding it. Cards would make that a scavenger hunt.
 */
export function InventorySection() {
  const { item, holds, pickChapter } = useSamples();
  const [filter, setFilter] = useState<ChapterFilter>(NO_FILTER);
  const [limit, setLimit] = useState(PAGE);

  const searchId = useId();
  const boardLabelId = useId();
  const classLabelId = useId();
  const subjectLabelId = useId();

  const rows = useMemo(() => listChapters(filter), [filter]);
  const visible = rows.slice(0, limit);
  const remaining = rows.length - visible.length;

  /** Every filter change restarts the paging — the sixth row of the old list is meaningless. */
  function narrow(change: Partial<ChapterFilter>) {
    setFilter((current) => ({ ...current, ...change }));
    setLimit(PAGE);
  }

  return (
    <section className="inventory wrap" id="inventory">
      <div className="inventory-head">
        <div>
          <p className="kicker">Inventory</p>
          <h2 className="display">Find your chapter.</h2>
        </div>
        <p className="result-count">
          {rows.length} {rows.length === 1 ? "chapter" : "chapters"} · answer key included
        </p>
      </div>

      <div className="filters">
        <Field label="Search chapter or subject" htmlFor={searchId}>
          <TextInput
            id={searchId}
            type="search"
            placeholder="e.g. Electricity"
            value={filter.query}
            onChange={(event) => narrow({ query: event.target.value })}
          />
        </Field>

        <Field label="Board" labelId={boardLabelId}>
          <Segmented
            value={filter.board}
            options={BOARDS}
            labelledBy={boardLabelId}
            onChange={(board) => narrow({ board })}
          />
        </Field>

        <Field label="Class" labelId={classLabelId}>
          <Segmented
            value={filter.cls}
            options={CLASSES}
            labelledBy={classLabelId}
            onChange={(cls) => narrow({ cls })}
          />
        </Field>

        <Field label="Subject" labelId={subjectLabelId} className="filters-subject">
          <Segmented
            value={filter.subject}
            options={SUBJECTS}
            labelledBy={subjectLabelId}
            onChange={(subject) => narrow({ subject })}
          />
        </Field>
      </div>

      {rows.length === 0 ? (
        <div className="empty-state">
          <h3>Nothing in stock for that.</h3>
          <p>
            We set made-to-order assignments for any Class 9–10 chapter. Tell us what you need and
            it comes back inside 24 hours.
          </p>
          <a className="btn btn-primary" href="#custom">
            Request it instead <span className="arr">→</span>
          </a>
        </div>
      ) : (
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>Chapter</th>
                <th>Contents</th>
                <th className="price">Sample</th>
                <th>
                  <span className="sr-only">Pick as your free sample</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((chapter) => {
                const added = holds(chapter.id);
                // One sample per address, so every other row offers a swap
                // rather than a second pick. Saying so on the button is the
                // only place the rule is visible before someone tries it.
                const taken = item !== null && !added;
                return (
                  <tr key={chapter.id}>
                    <td>
                      <div className="chapter-title">{chapter.title}</div>
                      <div className="chapter-meta">
                        {describeChapter(chapter)}
                        {chapter.inStock ? "" : " · made to order"}
                      </div>
                    </td>
                    <td style={{ color: "var(--text-dim)", whiteSpace: "nowrap" }}>
                      {describeContents(chapter)}
                    </td>
                    <td className="num price">
                      <s className="price-was">₹{chapter.price}</s>
                      <span className="price-free">Free</span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button
                        type="button"
                        className="btn btn-ghost btn-add"
                        onClick={() => pickChapter(chapter.id)}
                        aria-pressed={added}
                        // Six buttons reading "Pick" tell a screen reader
                        // nothing. Each name starts with the visible label, so
                        // "click Pick" still finds the right control.
                        aria-label={
                          added
                            ? `Picked: ${chapter.title}`
                            : taken
                              ? `Swap for ${chapter.title}`
                              : `Pick ${chapter.title}`
                        }
                      >
                        {added ? "Picked ✓" : taken ? "Swap" : "Pick"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {remaining > 0 ? (
        <div className="more-row">
          <button type="button" className="btn btn-ghost" onClick={() => setLimit(limit + PAGE)}>
            Show {Math.min(PAGE, remaining)} more · {remaining} left
          </button>
        </div>
      ) : null}

      <SampleBar />
    </section>
  );
}
