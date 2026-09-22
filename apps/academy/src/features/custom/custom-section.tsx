"use client";

import { useId, useMemo, useState } from "react";

import { Field, Select, TextInput } from "@/components/ui";
import { type Board, type ClassLevel, subjects } from "@/features/inventory/model";
import { MIX_LABEL } from "@/features/pricing/model";
import { useSamples } from "@/features/sample/store";
import {
  ADVANCED_OPTIONS,
  type AdvancedChoice,
  COPIES,
  type CustomRequest,
  describeRequest,
  quoteFor,
} from "@/lib/quote";
import { TURNAROUND } from "@/lib/site";

const BOARDS = [
  { value: "CBSE", label: "CBSE" },
  { value: "ICSE", label: "ICSE" },
] as const satisfies readonly { value: Board; label: string }[];

const CLASSES = [
  { value: "9", label: "Class 9" },
  { value: "10", label: "Class 10" },
] as const satisfies readonly { value: ClassLevel; label: string }[];

const SUBJECTS = subjects.map((subject) => ({ value: subject, label: subject }));

/**
 * The half of the catalogue that does not exist yet.
 *
 * The quote re-runs on every keystroke and sits beside the form rather than
 * behind a "get a quote" button: the question this page has to answer before
 * anything else is *what will this cost me*, and making that a round trip is
 * how a request form turns into an abandoned one.
 */
export function CustomSection() {
  const { pickCustom } = useSamples();

  const [board, setBoard] = useState<Board>("CBSE");
  const [cls, setCls] = useState<ClassLevel>("10");
  const [subject, setSubject] = useState<string>(SUBJECTS[0]?.value ?? "Mathematics");
  const [chapter, setChapter] = useState("");
  const [advanced, setAdvanced] = useState<AdvancedChoice>("no");
  // Held as text so the field can be empty mid-edit; `quoteFor` clamps.
  const [copies, setCopies] = useState(String(COPIES.default));

  const ids = {
    board: useId(),
    cls: useId(),
    subject: useId(),
    chapter: useId(),
    advanced: useId(),
    copies: useId(),
  };

  const request = useMemo<CustomRequest>(
    () => ({
      board,
      cls,
      subject,
      chapter,
      advanced: advanced === "yes",
      copies: Number(copies),
    }),
    [board, cls, subject, chapter, advanced, copies],
  );

  const quote = useMemo(() => quoteFor(request), [request]);
  const named = chapter.trim().length > 0;

  return (
    <section className="custom" id="custom">
      <div className="band-inner">
        <div className="custom-form">
          <p className="kicker">Made to order</p>
          <h2 className="display">Not in the inventory? Set it to my requirement.</h2>
          <p className="lede">
            Any chapter on either syllabus, set to the same mix as the shelf — {MIX_LABEL}, with the
            board questions and the NCERT exercise free on top. The price quotes as you fill it in.
          </p>

          <div className="custom-grid">
            <Field label="Board" labelId={ids.board}>
              <Select value={board} options={BOARDS} labelledBy={ids.board} onChange={setBoard} />
            </Field>

            <Field label="Class" labelId={ids.cls}>
              <Select value={cls} options={CLASSES} labelledBy={ids.cls} onChange={setCls} />
            </Field>

            <Field label="Subject" labelId={ids.subject}>
              <Select
                value={subject}
                options={SUBJECTS}
                labelledBy={ids.subject}
                onChange={setSubject}
              />
            </Field>

            <Field label="Chapter or topic" htmlFor={ids.chapter}>
              <TextInput
                id={ids.chapter}
                value={chapter}
                placeholder="e.g. Trigonometry — heights and distances"
                onChange={(event) => setChapter(event.target.value)}
              />
            </Field>

            <Field
              label="Advanced block"
              labelId={ids.advanced}
              hint="Higher-order and case-study questions, on top of the mix."
            >
              <Select
                value={advanced}
                options={ADVANCED_OPTIONS}
                labelledBy={ids.advanced}
                onChange={setAdvanced}
              />
            </Field>

            <Field
              label="Copies"
              htmlFor={ids.copies}
              hint="Eleven or more takes the class-set rate."
            >
              <TextInput
                id={ids.copies}
                type="number"
                inputMode="numeric"
                min={COPIES.min}
                max={COPIES.max}
                value={copies}
                onChange={(event) => setCopies(event.target.value)}
              />
            </Field>
          </div>
        </div>

        <div className="quote">
          <p className="label-xs">Quote for your request</p>
          <p className="quote-chapter">{named ? chapter.trim() : "Name the chapter on the left"}</p>
          <p className="quote-meta">{describeRequest(request, quote)}</p>

          <div className="quote-lines">
            {quote.lines.map((line) => (
              <div className="quote-line" key={line.label}>
                <span>{line.label}</span>
                <b className="num">{line.value}</b>
              </div>
            ))}
          </div>

          <div className="quote-total">
            <span className="label-xs">Total</span>
            <b className="num">₹{quote.total}</b>
          </div>

          <button
            type="button"
            className="btn btn-primary mt-6 w-full"
            disabled={!named}
            onClick={() => pickCustom({ ...request, chapter: chapter.trim() })}
          >
            {named ? "Ask for a sample of this" : "Enter a chapter to continue"}
          </button>

          <p className="quote-note">
            The quote is what the full set will cost once buying opens. Ask now and a free sample
            sheet set to this requirement is emailed within {TURNAROUND} — one per email address,
            and if we cannot set it the way you want, you hear that before anything is charged.
          </p>
        </div>
      </div>
    </section>
  );
}
