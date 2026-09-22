import { Marquee } from "@byteveda/ui";

const TERMS = [
  "CBSE",
  "ICSE",
  "Class 9",
  "Class 10",
  "Mathematics",
  "Science",
  "Physics",
  "Chemistry",
  "Biology",
  "Social Science",
  "English",
  "Answer keys included",
  "Board questions free",
  "NCERT exercise free",
  "Board and HOTS sets",
  "Emailed in 24h",
];

/** What the shelf holds, at a glance, without a paragraph about it. */
export function Strip() {
  return (
    <div className="strip">
      <Marquee
        items={TERMS}
        getKey={(term) => term}
        renderItem={(term) => <span className="strip-item">{term}</span>}
        durationSeconds={38}
        ariaLabel="Boards, classes and subjects we cover"
      />
    </div>
  );
}
