import Link from "next/link";
import { Footer } from "@/components/footer";
import { Navbar } from "@/components/navbar";

// taskito was renamed to FlexiQ, and its docs moved from /taskito/ to /flexiq/.
// Pages is static, so the 404 page is the only place a redirect can live; it runs
// before paint and keeps the rest of the path (and hash) intact.
const LEGACY_REDIRECT = `(function(){var p=location.pathname;if(p==="/taskito"||p.indexOf("/taskito/")===0){location.replace("/flexiq"+p.slice(8)+location.search+location.hash)}})()`;

export default function NotFound() {
  return (
    <>
      {/** biome-ignore lint/security/noDangerouslySetInnerHtml: inline redirect must run before paint */}
      <script dangerouslySetInnerHTML={{ __html: LEGACY_REDIRECT }} />
      <Navbar />
      <main className="flex flex-1 items-center">
        <div className="wrap py-24">
          <p className="font-mono text-muted-foreground text-xs uppercase tracking-widest">404</p>
          <h1 className="mt-4 font-semibold text-3xl text-foreground sm:text-4xl">
            No docs at this address.
          </h1>
          <p className="mt-4 max-w-lg text-muted-foreground text-sm leading-6">
            The page may have moved with a project rename — taskito is now{" "}
            {/* Mirrored subpath, not an app route — plain anchor, so no client-side routing. */}
            <a href="/flexiq/" className="text-accent hover:underline">
              FlexiQ
            </a>
            . Otherwise, start from the tool index.
          </p>
          <Link
            href="/"
            className="mt-8 inline-flex font-medium text-foreground text-sm hover:text-accent"
          >
            All tools →
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
