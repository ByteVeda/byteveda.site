"use server";

import {
  EMPTY_SEO,
  getDb,
  POST_FORMATS,
  type PostFormat,
  type PostSeo,
  type PostStatus,
  postRevisions,
  posts,
} from "@byteveda/db";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { announcePost } from "@/lib/broadcasts/service";
import { revalidateFlexiq } from "@/lib/publish/revalidate";
import { getTakenSlugs } from "./queries";
import { isValidSlug, slugify, uniqueSlug } from "./slug";

export type PostDraft = {
  title: string;
  slug: string;
  description: string;
  bodyMdx: string;
  bodyFormat: PostFormat;
  editorJson: unknown | null;
  tags: string[];
  seo: PostSeo;
  author: string;
};

export type ActionResult =
  | { ok: true; message: string }
  | { ok: false; message: string; field?: keyof PostDraft };

const MAX_TITLE = 200;
const MAX_DESCRIPTION = 400;
const MAX_TAGS = 8;
const MAX_TAG_LENGTH = 32;

/**
 * Server-side validation, because a server action is a public endpoint. The
 * editor checks the same things for a faster answer, not instead of this.
 */
function validate(draft: PostDraft): ActionResult | null {
  const title = draft.title.trim();
  if (!title) return { ok: false, message: "Give the post a title.", field: "title" };
  if (title.length > MAX_TITLE) {
    return { ok: false, message: `Titles are limited to ${MAX_TITLE} characters.`, field: "title" };
  }

  if (!isValidSlug(draft.slug)) {
    return {
      ok: false,
      message: "The slug must be lowercase words separated by single hyphens.",
      field: "slug",
    };
  }

  if (draft.description.length > MAX_DESCRIPTION) {
    return {
      ok: false,
      message: `Descriptions are limited to ${MAX_DESCRIPTION} characters.`,
      field: "description",
    };
  }

  if (!POST_FORMATS.includes(draft.bodyFormat)) {
    return { ok: false, message: "Unknown editor format.", field: "bodyFormat" };
  }

  if (draft.tags.length > MAX_TAGS) {
    return { ok: false, message: `Up to ${MAX_TAGS} tags.`, field: "tags" };
  }
  if (draft.tags.some((tag) => !tag.trim() || tag.length > MAX_TAG_LENGTH)) {
    return {
      ok: false,
      message: `Tags must be non-empty and under ${MAX_TAG_LENGTH} characters.`,
      field: "tags",
    };
  }

  return null;
}

function normalise(draft: PostDraft): PostDraft {
  return {
    ...draft,
    title: draft.title.trim(),
    slug: draft.slug.trim(),
    description: draft.description.trim(),
    author: draft.author.trim() || "ByteVeda",
    tags: [...new Set(draft.tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean))],
    seo: {
      keywords: draft.seo.keywords ?? [],
      metaTitle: draft.seo.metaTitle?.trim() || undefined,
      metaDescription: draft.seo.metaDescription?.trim() || undefined,
      ogImage: draft.seo.ogImage?.trim() || undefined,
    },
  };
}

/** Creates an empty draft and opens it. The slug is provisional and editable. */
export async function createDraft(): Promise<never> {
  await requireSession();

  const taken = await getTakenSlugs("flexiq");
  const slug = uniqueSlug(slugify(`untitled ${new Date().toISOString().slice(0, 10)}`), taken);

  const [created] = await getDb()
    .insert(posts)
    .values({ site: "flexiq", slug, title: "Untitled", seo: EMPTY_SEO })
    .returning({ id: posts.id });

  revalidatePath("/posts");
  redirect(`/posts/${created.id}`);
}

export async function savePost(id: string, input: PostDraft): Promise<ActionResult> {
  const { user } = await requireSession();
  const draft = normalise(input);

  const invalid = validate(draft);
  if (invalid) return invalid;

  const db = getDb();
  const [existing] = await db.select().from(posts).where(eq(posts.id, id)).limit(1);
  if (!existing) return { ok: false, message: "That post no longer exists." };

  if ((await getTakenSlugs(existing.site, id)).includes(draft.slug)) {
    return { ok: false, message: "Another post already uses that slug.", field: "slug" };
  }

  // Snapshot what is being replaced, not what replaces it — restoring a
  // revision should undo one save.
  const changed =
    existing.title !== draft.title ||
    existing.description !== draft.description ||
    existing.bodyMdx !== draft.bodyMdx;

  if (changed) {
    await db.insert(postRevisions).values({
      postId: id,
      title: existing.title,
      description: existing.description,
      bodyMdx: existing.bodyMdx,
      bodyFormat: existing.bodyFormat,
      editorJson: existing.editorJson,
      authorId: user.id,
    });
  }

  await db
    .update(posts)
    .set({
      title: draft.title,
      slug: draft.slug,
      description: draft.description,
      bodyMdx: draft.bodyMdx,
      bodyFormat: draft.bodyFormat,
      editorJson: draft.editorJson,
      tags: draft.tags,
      seo: draft.seo,
      author: draft.author,
      updatedAt: new Date(),
    })
    .where(eq(posts.id, id));

  revalidatePath(`/posts/${id}`);
  revalidatePath("/posts");

  // A live post that changed has to reach the site as well as the database.
  if (existing.status === "published") {
    const site = await revalidateFlexiq(draft.slug);
    return {
      ok: true,
      message: site.ok ? "Saved and live." : `Saved. ${site.detail}`,
    };
  }

  return { ok: true, message: "Saved." };
}

export async function setPostStatus(id: string, status: PostStatus): Promise<ActionResult> {
  await requireSession();

  const db = getDb();
  const [existing] = await db.select().from(posts).where(eq(posts.id, id)).limit(1);
  if (!existing) return { ok: false, message: "That post no longer exists." };

  if (status === "published" && !existing.title.trim()) {
    return { ok: false, message: "Give the post a title before publishing." };
  }

  const [updated] = await db
    .update(posts)
    .set({
      status,
      // The database constrains these two to agree; keep the original date on
      // a re-publish so a correction does not reorder the index.
      publishedAt: status === "published" ? (existing.publishedAt ?? new Date()) : null,
      updatedAt: new Date(),
    })
    .where(eq(posts.id, id))
    .returning();

  revalidatePath(`/posts/${id}`);
  revalidatePath("/posts");

  const site = await revalidateFlexiq(existing.slug);
  const verb = { published: "Published", draft: "Moved back to draft", archived: "Archived" }[
    status
  ];

  // Announcing is a side effect of publishing, not part of it. A mail failure
  // is reported alongside the success, never as one.
  let announced: string | null = null;
  if (status === "published" && updated) {
    try {
      announced = await announcePost(updated);
    } catch (error) {
      console.error("[posts] announcement failed", error);
      announced = "The announcement email did not send.";
    }
  }

  return {
    ok: true,
    message: [`${verb}.`, site.ok ? null : site.detail, announced].filter(Boolean).join(" "),
  };
}

export async function deletePost(id: string): Promise<never> {
  await requireSession();

  const db = getDb();
  const [existing] = await db.select().from(posts).where(eq(posts.id, id)).limit(1);
  await db.delete(posts).where(eq(posts.id, id));

  if (existing?.status === "published") await revalidateFlexiq(existing.slug);

  revalidatePath("/posts");
  redirect("/posts");
}

/** Puts a past revision back into the editor, keeping the current one recoverable. */
export async function restoreRevision(postId: string, revisionId: string): Promise<ActionResult> {
  const { user } = await requireSession();

  const db = getDb();
  const [revision] = await db
    .select()
    .from(postRevisions)
    .where(eq(postRevisions.id, revisionId))
    .limit(1);

  if (!revision || revision.postId !== postId) {
    return { ok: false, message: "That revision is not available." };
  }

  const [existing] = await db.select().from(posts).where(eq(posts.id, postId)).limit(1);
  if (!existing) return { ok: false, message: "That post no longer exists." };

  // Restoring is itself a change worth being able to undo.
  await db.insert(postRevisions).values({
    postId,
    title: existing.title,
    description: existing.description,
    bodyMdx: existing.bodyMdx,
    bodyFormat: existing.bodyFormat,
    editorJson: existing.editorJson,
    authorId: user.id,
  });

  await db
    .update(posts)
    .set({
      title: revision.title,
      description: revision.description,
      bodyMdx: revision.bodyMdx,
      bodyFormat: revision.bodyFormat,
      editorJson: revision.editorJson,
      updatedAt: new Date(),
    })
    .where(eq(posts.id, postId));

  revalidatePath(`/posts/${postId}`);
  if (existing.status === "published") await revalidateFlexiq(existing.slug);

  return { ok: true, message: "Restored." };
}
