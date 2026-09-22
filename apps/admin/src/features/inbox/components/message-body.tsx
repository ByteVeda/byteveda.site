"use client";

import { CodeXml, Type } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Props = { text: string; html: string | null };

/**
 * Everything the frame is allowed to do, which is very nearly nothing.
 *
 * Mail is the least trustworthy HTML a console will ever render: it is written
 * by anyone who knows the address. `default-src 'none'` means a document that
 * cannot fetch, cannot frame, and cannot phone home; images and inline style are
 * opened back up because without them a real message looks broken.
 *
 * Remote images do load, which is how a sender learns the mail was opened. That
 * is the trade — this is an inbox for replies from people we wrote to first, not
 * a reader for bulk mail.
 */
const CSP = [
  "default-src 'none'",
  "img-src data: https: http:",
  "style-src 'unsafe-inline'",
  "font-src data:",
  "frame-src 'none'",
].join("; ");

/**
 * The page the frame renders.
 *
 * Styled for the sender, not for the console: HTML mail is written against a
 * white background, and re-colouring it for a dark theme is how a signature
 * turns into black text on black. `<base target="_blank">` sends every link out
 * to a new tab, since the frame has no permission to navigate anything itself.
 */
function frameDocument(html: string): string {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${CSP}">
<base target="_blank">
<style>
  html { color-scheme: light }
  body {
    margin: 0;
    padding: 14px 16px;
    background: #ffffff;
    color: #1b1a15;
    font: 14px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
    overflow-wrap: anywhere;
  }
  img, table { max-width: 100% }
  img { height: auto }
  blockquote {
    margin: 12px 0;
    padding-left: 12px;
    border-left: 2px solid #d8d4c8;
    color: #615d52;
  }
  pre { white-space: pre-wrap }
</style>
</head>
<body>${html}</body>
</html>`;
}

/**
 * A message, in whichever form the sender provided.
 *
 * Plain text is the default: it inherits the console's typography, it cannot
 * surprise anyone, and for a reply from a person it is the same words. The HTML
 * alternative is one click away, and a message that only came as HTML opens
 * there to begin with.
 */
export function MessageBody({ text, html }: Props) {
  const plain = text.trim();
  const rich = html?.trim() ? html : null;
  const [showHtml, setShowHtml] = useState(!plain && Boolean(rich));

  // No instruction here on purpose. Whether re-opening would help is something
  // only the fetch knows, and `ThreadOpener` says so above when it does not.
  if (!plain && !rich) {
    return <p className="message-empty">This message has no body.</p>;
  }

  return (
    <>
      {showHtml && rich ? <HtmlFrame html={rich} /> : <div className="message-body">{plain}</div>}

      {plain && rich ? (
        <button type="button" className="message-toggle" onClick={() => setShowHtml(!showHtml)}>
          {showHtml ? <Type aria-hidden /> : <CodeXml aria-hidden />}
          {showHtml ? "Show plain text" : "Show the formatted message"}
        </button>
      ) : null}
    </>
  );
}

/**
 * Renders mail HTML inside a sandboxed frame.
 *
 * `sandbox` without `allow-scripts` is the whole security model: nothing in the
 * document executes, so there is no script to escape the frame in the first
 * place. `allow-same-origin` is what lets this side measure the content — which
 * is safe precisely because scripts are off. `allow-popups` is for the links.
 *
 * The height is measured rather than guessed: a frame has no intrinsic size, so
 * left alone it renders every message at the same arbitrary box with its own
 * scrollbar. The observer catches the reflow when images finish loading.
 */
function HtmlFrame({ html }: { html: string }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(160);

  useEffect(() => {
    const element = frame.current;
    if (!element) return;

    let observer: ResizeObserver | undefined;

    const measure = () => {
      const body = element.contentDocument?.body;
      if (!body) return;

      setHeight(Math.ceil(body.scrollHeight));

      observer?.disconnect();
      observer = new ResizeObserver(() => setHeight(Math.ceil(body.scrollHeight)));
      observer.observe(body);
    };

    element.addEventListener("load", measure);
    // Already loaded by the time the effect runs, which srcdoc often is.
    measure();

    return () => {
      element.removeEventListener("load", measure);
      observer?.disconnect();
    };
  }, []);

  return (
    <iframe
      ref={frame}
      className="message-html"
      title="Message"
      srcDoc={frameDocument(html)}
      sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      referrerPolicy="no-referrer"
      style={{ height }}
    />
  );
}
