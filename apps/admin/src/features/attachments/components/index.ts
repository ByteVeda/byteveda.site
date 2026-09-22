/**
 * The client door into this feature.
 *
 * Apart from `index.ts` on purpose: that barrel reaches `queries.ts` and so the
 * database, and a `"use client"` composer that imported it would drag `pg`
 * towards the browser bundle. Inbox and broadcasts import the picker from
 * here.
 */
export { type AttachedFile, AttachmentPicker } from "./attachment-picker";
