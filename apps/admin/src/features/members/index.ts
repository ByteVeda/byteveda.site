/**
 * Who gets into the console, and what they may do once they are in.
 *
 * The public surface of the feature. Server code — the members page, the OAuth
 * callback that decides whether an account is admitted — imports from here and
 * never from a file inside. Client components must not, because this barrel
 * reaches the database; they import `@/features/members/model` for the role
 * shape a dropdown reads and `@/features/members/actions` for the writes.
 *
 * The page component is exported straight from its file rather than through
 * `components/`, which would put a server component behind the door a client
 * component is allowed to open.
 */

export { MembersPage } from "./components/members-page";
export { admit } from "./service";
