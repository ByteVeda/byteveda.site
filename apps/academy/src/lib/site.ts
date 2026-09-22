import { ACADEMY_DOMAIN, ACADEMY_URL, CONTACT_EMAIL, MAIN_URL, ORG } from "@byteveda/utils";
import { PRICING } from "./pricing";

export const site = {
  name: "ByteVeda Academy",
  domain: ACADEMY_DOMAIN,
  url: ACADEMY_URL,
  tagline: "Chapter-wise assignments, emailed in 24 hours",
  // The figure is interpolated, not typed out. This string is the search
  // result and the link preview — the one place a stale price is quoted to
  // somebody who has not opened the site yet.
  description: `Stocked CBSE and ICSE worksheets for Class 9 and 10 at ₹${PRICING.chapter} a chapter, with the board questions, the NCERT exercise and the answer key free. Board and HOTS sets by subject. Pick a chapter or have one set to your requirement, and ask for a free sample — it lands in your inbox within 24 hours.`,
  org: ORG,
  orgUrl: MAIN_URL,
  contactEmail: CONTACT_EMAIL,
} as const;

/** Rooted, not bare fragments: the nav also renders on /sample. */
export const nav = [
  { label: "Inventory", href: "/#inventory" },
  { label: "Subject sets", href: "/#sets" },
  { label: "Custom request", href: "/#custom" },
  { label: "Delivery", href: "/#delivery" },
] as const;

/** How long we give ourselves between a request landing and the PDF going out. */
export const TURNAROUND = "24 hours";
