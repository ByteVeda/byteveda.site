/**
 * What we stock, and how a chapter of it reads.
 *
 * The public surface of the feature: the quote engine and the order model
 * import from here and never from a file inside. Client components import
 * `@/features/inventory/model`, and the counter itself is in `./components`.
 */

export {
  type Board,
  type Chapter,
  type ClassLevel,
  chapters,
  describeChapter,
  describeContents,
} from "./model";
