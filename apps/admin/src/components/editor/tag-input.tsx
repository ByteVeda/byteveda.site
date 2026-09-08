"use client";

import { X } from "lucide-react";
import { type KeyboardEvent, useState } from "react";

type Props = {
  tags: string[];
  onChange: (tags: string[]) => void;
  max?: number;
};

export function TagInput({ tags, onChange, max = 8 }: Props) {
  const [draft, setDraft] = useState("");

  function add() {
    const tag = draft.trim().toLowerCase();
    if (!tag || tags.includes(tag) || tags.length >= max) {
      setDraft("");
      return;
    }
    onChange([...tags, tag]);
    setDraft("");
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      add();
      return;
    }
    // Backspace on an empty field removes the last tag, which is what every
    // other tag field does.
    if (event.key === "Backspace" && !draft && tags.length) {
      onChange(tags.slice(0, -1));
    }
  }

  return (
    <div>
      {tags.length > 0 && (
        <div className="tag-row" style={{ marginBottom: 7 }}>
          {tags.map((tag) => (
            <span key={tag} className="tag">
              {tag}
              <button
                type="button"
                onClick={() => onChange(tags.filter((other) => other !== tag))}
                aria-label={`Remove ${tag}`}
              >
                <X width={11} height={11} aria-hidden />
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        className="input input-mono"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={onKeyDown}
        onBlur={add}
        placeholder={tags.length >= max ? `${max} tags is the limit` : "Add a tag, then Enter"}
        disabled={tags.length >= max}
      />
    </div>
  );
}
