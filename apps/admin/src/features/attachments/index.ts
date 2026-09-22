/**
 * Files on their way out: what may be attached, where it waits, who may have it.
 *
 * The public surface of the feature. Server code — a route handler, a page, an
 * action in another feature — imports from here and never from a file inside.
 * Client components must not, because this barrel reaches the database: the
 * rules they need are in `./model`, and the picker is in `./components`.
 */

export { maxFileBytes } from "./limits";
export { checkAttachment, formatBytes, parseScope, type StagedFile } from "./model";
export {
  authoriseDownload,
  authoriseScope,
  describe,
  listStaged,
  load,
  loadForSend,
} from "./queries";
export { claim, discard, discardAll, pruneStale, stage } from "./store";
