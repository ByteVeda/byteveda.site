import Link from "next/link";

import { site } from "@/lib/site";

export function Footer() {
  return (
    <footer className="rule-top">
      <div className="wrap foot">
        <div>
          <strong>{site.name}</strong>
          <p>
            Chapter-wise assignments for CBSE and ICSE, Class 9 and 10. Stocked, set to requirement,
            emailed.
          </p>
        </div>

        <div className="foot-cols">
          <div className="foot-col">
            <span className="label-xs">Sheets</span>
            <Link href="/#inventory">Inventory</Link>
            <Link href="/#custom">Custom request</Link>
            <Link href="/sample">Your sample</Link>
          </div>
          <div className="foot-col">
            <span className="label-xs">Contact</span>
            <a href={`mailto:${site.contactEmail}`}>{site.contactEmail}</a>
            <Link href="/#delivery">Delivery terms</Link>
          </div>
          <div className="foot-col">
            <span className="label-xs">ByteVeda</span>
            <a href={site.orgUrl}>byteveda.org</a>
          </div>
        </div>

        <p className="foot-legal">© {new Date().getFullYear()} ByteVeda</p>
      </div>
    </footer>
  );
}
