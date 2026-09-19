import { TURNAROUND } from "@/lib/site";

const STEPS = [
  {
    index: "STEP 01",
    title: "Pick or describe",
    body: "Add stocked chapters to your sample request, or describe a requirement for anything we don’t hold.",
  },
  {
    index: "STEP 02",
    title: "Leave an email",
    body: "One address, no account to create, nothing to pay. Buying the full sets is coming soon — asking for a sample today costs nothing and commits you to nothing.",
  },
  {
    index: "STEP 03",
    title: "Check your inbox",
    body: `Print-ready sample PDFs with the answer key, emailed within ${TURNAROUND} of the request.`,
  },
];

/** What happens after the button, in the order it happens. */
export function Delivery() {
  return (
    <section className="cells reveal" id="delivery">
      {STEPS.map((step) => (
        <div className="cell" key={step.index}>
          <p className="step-index">{step.index}</p>
          <h3>{step.title}</h3>
          <p>{step.body}</p>
        </div>
      ))}
    </section>
  );
}
