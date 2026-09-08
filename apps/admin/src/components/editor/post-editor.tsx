"use client";

import type { Post, PostFormat, PostSeo } from "@byteveda/db";
import { Placeholder } from "@tiptap/extensions";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { ExternalLink, Eye, EyeOff, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { SeoPanel } from "@/components/editor/seo-panel";
import { TagInput } from "@/components/editor/tag-input";
import { Toolbar } from "@/components/editor/toolbar";
import {
  type ActionResult,
  deletePost,
  type PostDraft,
  restoreRevision,
  savePost,
  setPostStatus,
} from "@/lib/posts/actions";
import { containsJsx, htmlToMarkdown, markdownToHtml } from "@/lib/posts/markdown";
import type { RevisionListItem } from "@/lib/posts/queries";
import { isValidSlug, slugify } from "@/lib/posts/slug";

const FLEXIQ_URL = "https://flexiq.byteveda.org";
/** Long enough that typing does not trigger a conversion on every keystroke. */
const SYNC_DELAY_MS = 250;

type Props = {
  post: Post;
  corpus: string[];
  revisions: RevisionListItem[];
};

type Message = { text: string; tone: "ok" | "error" | "idle" } | null;

export function PostEditor({ post, corpus, revisions }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [title, setTitle] = useState(post.title);
  const [description, setDescription] = useState(post.description);
  const [slug, setSlug] = useState(post.slug);
  const [tags, setTags] = useState<string[]>(post.tags);
  const [seo, setSeo] = useState<PostSeo>(post.seo);
  const [format, setFormat] = useState<PostFormat>(post.bodyFormat);
  const [bodyMdx, setBodyMdx] = useState(post.bodyMdx);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState<Message>(null);

  // Tiptap's document, kept in a ref because it changes on every keystroke and
  // nothing renders from it.
  const editorJson = useRef<unknown>(post.editorJson ?? null);
  const [richVersion, setRichVersion] = useState(0);

  const editor = useEditor({
    // The editor cannot render during SSR; Tiptap requires opting out explicitly.
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ link: { openOnClick: false, autolink: true } }),
      Placeholder.configure({ placeholder: "Start writing…" }),
    ],
    content: post.editorJson ?? markdownToHtml(post.bodyMdx),
    editorProps: { attributes: { class: "prose-editor-body" } },
    onUpdate: () => setRichVersion((version) => version + 1),
  });

  /* Rich text is the input; `body_mdx` is what ships. Convert on a delay so a
     burst of typing costs one conversion rather than dozens. */
  useEffect(() => {
    if (format !== "richtext" || !editor || richVersion === 0) return;

    const timer = setTimeout(() => {
      editorJson.current = editor.getJSON();
      setBodyMdx(htmlToMarkdown(editor.getHTML()));
      setDirty(true);
    }, SYNC_DELAY_MS);

    return () => clearTimeout(timer);
  }, [richVersion, editor, format]);

  /* A brand-new draft carries a placeholder slug. Track the title until the
     operator either publishes or edits the slug by hand. */
  const slugIsProvisional = post.slug.startsWith("untitled-") && post.status === "draft";
  useEffect(() => {
    if (!slugIsProvisional || slug !== post.slug) return;
    const derived = slugify(title);
    if (derived) setSlug(derived);
  }, [title, slugIsProvisional, slug, post.slug]);

  const draft = useMemo<PostDraft>(
    () => ({
      title,
      slug,
      description,
      bodyMdx,
      bodyFormat: format,
      editorJson: format === "richtext" ? editorJson.current : null,
      tags,
      seo,
      author: post.author,
    }),
    [title, slug, description, bodyMdx, format, tags, seo, post.author],
  );

  const save = useCallback(() => {
    startTransition(async () => {
      const result: ActionResult = await savePost(post.id, draft);
      setMessage({ text: result.message, tone: result.ok ? "ok" : "error" });
      if (result.ok) {
        setDirty(false);
        router.refresh();
      }
    });
  }, [draft, post.id, router]);

  /* Ctrl/Cmd+S is what a writer's hands already do. */
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        save();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [save]);

  useEffect(() => {
    if (!dirty) return;
    function warn(event: BeforeUnloadEvent) {
      event.preventDefault();
    }
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function switchFormat(next: PostFormat) {
    if (next === format) return;

    if (next === "mdx") {
      // Rich text has already been serialised into bodyMdx by the sync effect.
      setFormat("mdx");
      setMessage({
        text: "Editing the source directly. Switching back needs plain Markdown.",
        tone: "idle",
      });
      return;
    }

    if (containsJsx(bodyMdx)) {
      setMessage({
        text: "This post uses MDX components, which rich text cannot represent. Staying on source.",
        tone: "error",
      });
      return;
    }

    editor?.commands.setContent(markdownToHtml(bodyMdx));
    editorJson.current = editor?.getJSON() ?? null;
    setFormat("richtext");
    setMessage(null);
  }

  function changeStatus(status: Post["status"]) {
    startTransition(async () => {
      const result = await setPostStatus(post.id, status);
      setMessage({ text: result.message, tone: result.ok ? "ok" : "error" });
      router.refresh();
    });
  }

  function remove() {
    if (!window.confirm(`Delete "${post.title}"? This cannot be undone.`)) return;
    startTransition(() => deletePost(post.id));
  }

  function restore(revisionId: string) {
    if (dirty && !window.confirm("You have unsaved changes. Restore anyway?")) return;
    startTransition(async () => {
      const result = await restoreRevision(post.id, revisionId);
      setMessage({ text: result.message, tone: result.ok ? "ok" : "error" });
      router.refresh();
    });
  }

  const published = post.status === "published";
  const slugError = slug && !isValidSlug(slug);

  return (
    <>
      <header className="topbar">
        <span className={`state state-${post.status}`}>{post.status}</span>
        <span className="save-state" data-tone={message?.tone ?? "idle"}>
          {pending ? "Saving…" : (message?.text ?? (dirty ? "Unsaved changes" : "Saved"))}
        </span>

        <div className="topbar-actions">
          {published && (
            <a
              className="abtn abtn-quiet abtn-sm"
              href={`${FLEXIQ_URL}/blog/${post.slug}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink aria-hidden />
              View
            </a>
          )}
          <button type="button" className="abtn abtn-quiet" onClick={remove} disabled={pending}>
            <Trash2 aria-hidden />
            Delete
          </button>
          {published ? (
            <button
              type="button"
              className="abtn abtn-quiet"
              onClick={() => changeStatus("draft")}
              disabled={pending}
            >
              <EyeOff aria-hidden />
              Unpublish
            </button>
          ) : (
            <button
              type="button"
              className="abtn abtn-quiet"
              onClick={() => changeStatus("published")}
              disabled={pending || dirty}
              title={dirty ? "Save your changes first" : undefined}
            >
              <Eye aria-hidden />
              Publish
            </button>
          )}
          <button
            type="button"
            className="abtn abtn-primary"
            onClick={save}
            disabled={pending || !dirty}
          >
            Save
          </button>
        </div>
      </header>

      <div className="editor">
        <div className="editor-main">
          <input
            className="editor-title"
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
              setDirty(true);
            }}
            placeholder="Title"
            aria-label="Post title"
          />
          <textarea
            className="editor-description"
            value={description}
            onChange={(event) => {
              setDescription(event.target.value);
              setDirty(true);
            }}
            placeholder="One or two sentences, used as the summary and the search snippet."
            rows={2}
            aria-label="Post description"
          />

          <div className="editor-bar">
            {format === "richtext" && editor ? (
              <Toolbar editor={editor} />
            ) : (
              <span style={{ color: "var(--text-faint)", fontSize: "0.78rem" }}>
                Markdown and MDX, rendered on the right.
              </span>
            )}

            <fieldset className="seg">
              <legend className="sr-only">Editor mode</legend>
              <button
                type="button"
                aria-pressed={format === "richtext"}
                onClick={() => switchFormat("richtext")}
              >
                Rich text
              </button>
              <button
                type="button"
                aria-pressed={format === "mdx"}
                onClick={() => switchFormat("mdx")}
              >
                Source
              </button>
            </fieldset>
          </div>

          {format === "richtext" ? (
            <div className="prose-editor">
              <EditorContent editor={editor} />
            </div>
          ) : (
            <div className="mdx-split">
              <textarea
                className="mdx-source"
                value={bodyMdx}
                onChange={(event) => {
                  setBodyMdx(event.target.value);
                  setDirty(true);
                }}
                spellCheck={false}
                aria-label="Post source"
              />
              {/* The preview renders Markdown. MDX components are left as source,
                  because rendering them would mean running the site's pipeline. */}
              <div
                className="mdx-preview"
                // biome-ignore lint/security/noDangerouslySetInnerHtml: the operator's own draft, behind a login
                dangerouslySetInnerHTML={{ __html: markdownToHtml(bodyMdx) }}
              />
            </div>
          )}
        </div>

        <aside className="editor-side">
          <div className="side-block">
            <div className="field">
              <label htmlFor="post-slug">Slug</label>
              <input
                id="post-slug"
                className="input input-mono"
                value={slug}
                onChange={(event) => {
                  setSlug(event.target.value);
                  setDirty(true);
                }}
              />
              {slugError ? (
                <span className="err">Lowercase words separated by single hyphens.</span>
              ) : (
                <span className="hint">/blog/{slug || "…"}</span>
              )}
            </div>

            <div className="field">
              <label htmlFor="post-tags">Tags</label>
              <TagInput
                tags={tags}
                onChange={(next) => {
                  setTags(next);
                  setDirty(true);
                }}
              />
            </div>
          </div>

          <SeoPanel
            title={title}
            description={description}
            slug={slug}
            body={bodyMdx}
            tags={tags}
            corpus={corpus}
            seo={seo}
            onChange={(next) => {
              setSeo(next);
              setDirty(true);
            }}
          />

          <div className="side-block">
            <h2>History</h2>
            {revisions.length === 0 ? (
              <p style={{ color: "var(--text-faint)", fontSize: "0.78rem" }}>
                Saved versions appear here.
              </p>
            ) : (
              revisions.map((revision) => (
                <div key={revision.id} className="revision">
                  <span className="when">
                    {new Date(revision.createdAt).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <button
                    type="button"
                    className="abtn abtn-quiet abtn-sm"
                    onClick={() => restore(revision.id)}
                    disabled={pending}
                  >
                    Restore
                  </button>
                </div>
              ))
            )}
          </div>
        </aside>
      </div>
    </>
  );
}
