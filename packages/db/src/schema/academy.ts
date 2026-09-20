import { index, integer, jsonb, pgSchema, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { SAMPLE_KINDS, type SampleKind } from "../constants";

export type { SampleKind };
export { SAMPLE_KINDS };

/**
 * A namespace of its own, not `public`.
 *
 * Everything else in this database belongs to one system — the blog, its
 * mailing list, the console's own tables — and they reference each other.
 * Academy references none of them and nothing references it. Giving it a schema
 * says so in the one place that cannot drift: `academy.sample_requests` can be
 * dumped, granted, or dropped without reading a single table name in `public`.
 */
export const academy = pgSchema("academy");

/** A real Postgres enum, so the closed set is the column's type. */
export const sampleKind = academy.enum("sample_kind", SAMPLE_KINDS);

/**
 * One free sample, one address, forever.
 *
 * Nothing is charged for a sample, so the address is the whole of the price.
 * The unique constraint below is the enforcement — not the check the route runs
 * first. That check exists to give a person a sentence instead of an error, but
 * two requests racing each other both pass it, and only the constraint decides
 * which one is the second. A caller that treats a unique violation as "already
 * had one" is correct under concurrency; a caller that only looks before it
 * leaps is not.
 *
 * The address is stored lowercased. `claimSample` is the only writer and
 * normalises on the way in, which is what makes the constraint cover
 * `Foo@x.com` and `foo@x.com` as well — there is no case-folding rule in the
 * database itself, so a second writer would have to keep the same promise.
 *
 * What was asked for is written down rather than referenced. A catalogue slug
 * is a moving target — chapters get renamed and withdrawn — and this table has
 * to answer "what did we send this person?" a year later, when the row is the
 * only copy left.
 */
export const sampleRequests = academy.table(
  "sample_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull().unique("sample_requests_email_key"),
    /** `BVA-A1B2C3`, quoted back to the visitor and in the subject line. */
    reference: text("reference").notNull(),
    kind: sampleKind("kind").notNull(),
    /** The catalogue slug, when it came off the shelf. Null for a described one. */
    chapterId: text("chapter_id"),
    /** As shown, not as looked up — the catalogue moves, this row does not. */
    title: text("title").notNull(),
    /** The board, class, subject and contents line that went with it. */
    detail: text("detail").notNull().default(""),
    /** The made-to-order parameters, verbatim. Null for a stocked chapter. */
    request: jsonb("request").$type<Record<string, unknown>>(),
    /** What the full set would have cost. Nothing was charged; this is context. */
    listValue: integer("list_value").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("sample_requests_created_idx").on(table.createdAt)],
);

export type SampleRequest = typeof sampleRequests.$inferSelect;
