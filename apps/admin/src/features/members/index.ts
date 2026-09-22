/**
 * Who gets into the console, and what they may do once they are in.
 *
 * The public surface of the feature. Server code — the members page, the OAuth
 * callback that decides whether an account is admitted — imports from here and
 * never from a file inside. Client components must not, because this barrel
 * reaches the database; they import `@/features/members/model` for the role
 * shape a dropdown reads and `@/features/members/actions` for the writes.
 *
 * The members page is not here: a route reaches it by its own path, so that a
 * server component never sits behind a door a client component may open.
 */

export { admit } from "./service";
