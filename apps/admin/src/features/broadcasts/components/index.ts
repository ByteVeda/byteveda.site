/**
 * The client door into this feature.
 *
 * Apart from `index.ts` on purpose: that barrel reaches `service.ts` and so the
 * database, and a page that imported the composer through it would drag the
 * whole server graph — and `lucide-react` with it — into every module that
 * opens the front door. The subscribers page hosts the composer and comes in
 * here.
 */
export { BroadcastComposer } from "./broadcast-composer";
