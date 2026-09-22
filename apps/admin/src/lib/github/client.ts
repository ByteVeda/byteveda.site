import { env } from "@/lib/env";

const AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
const TOKEN_URL = "https://github.com/login/oauth/access_token";
const USER_URL = "https://api.github.com/user";
/** The public profile of somebody else, by login. `USER_URL` is "whoever this token is". */
const PROFILE_URL = "https://api.github.com/users";

export type GitHubUser = {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
};

export function authorizeUrl(redirectUri: string, state: string): string {
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("client_id", env.githubClientId());
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  // The allowlist is the authorisation; the token only has to prove identity.
  url.searchParams.set("scope", "read:user");
  url.searchParams.set("allow_signup", "false");
  return url.toString();
}

export async function exchangeCode(code: string, redirectUri: string): Promise<string> {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify({
      client_id: env.githubClientId(),
      client_secret: env.githubClientSecret(),
      redirect_uri: redirectUri,
      code,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`GitHub rejected the token exchange (${response.status})`);
  }

  // A failed exchange still comes back as 200 with an `error` field.
  const body = (await response.json()) as { access_token?: string; error_description?: string };
  if (!body.access_token) {
    throw new Error(body.error_description ?? "GitHub returned no access token");
  }
  return body.access_token;
}

/**
 * Looks up an account by its login, so an invite can be typed as `@someone`
 * rather than as a number nobody knows.
 *
 * Unauthenticated, which is all this needs: the profile is public and the
 * endpoint allows sixty calls an hour per address — several orders of magnitude
 * more invites than this console will ever send. A rate limit or a network
 * failure comes back as `null` and the members page then asks for the numeric
 * id instead, because the id is what is actually stored either way.
 */
export async function findUserByLogin(login: string): Promise<GitHubUser | null> {
  const handle = login.trim().replace(/^@/, "");
  // GitHub logins are alphanumeric with single hyphens; anything else is not a
  // login, and putting it in a URL path would be a request we cannot predict.
  if (!/^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/.test(handle)) return null;

  const response = await fetch(`${PROFILE_URL}/${handle}`, {
    headers: { accept: "application/vnd.github+json", "user-agent": "byteveda-admin" },
    cache: "no-store",
  });

  if (!response.ok) return null;

  const user = (await response.json()) as {
    id: number;
    login: string;
    name: string | null;
    avatar_url: string | null;
  };

  return {
    id: user.id,
    login: user.login,
    name: user.name,
    // The public profile carries an address only when its owner published one,
    // and an invite does not need it — the row is keyed by id.
    email: null,
    avatarUrl: user.avatar_url,
  };
}

export async function fetchUser(accessToken: string): Promise<GitHubUser> {
  const response = await fetch(USER_URL, {
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${accessToken}`,
      "user-agent": "byteveda-admin",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Could not read the GitHub profile (${response.status})`);
  }

  const user = (await response.json()) as {
    id: number;
    login: string;
    name: string | null;
    email: string | null;
    avatar_url: string | null;
  };

  return {
    id: user.id,
    login: user.login,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatar_url,
  };
}
