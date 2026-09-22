/**
 * Scoring a draft the way a search engine would read it.
 *
 * The public surface of the feature. Nothing here reaches the database — the
 * whole feature is `model.ts` — so this is a front door onto rules that are
 * client-safe anyway. The editor's SEO panel is a `"use client"` file and so
 * imports `./model`, which is the door open to it; server code that wants the
 * same answers comes through here.
 */

export { auditPost, auditScore, extractKeywords } from "./model";
