import { config } from "./config";

export type HttpInit = {
  headers?: Record<string, string>;
  method?: "GET" | "POST";
  body?: string;
  retries?: number;
  timeoutMs?: number;
};

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly url: string,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

async function request(url: string, init: HttpInit): Promise<Response> {
  const { headers = {}, method = "GET", body, retries = 3, timeoutMs = 15000 } = init;
  let attempt = 0;
  let lastError: unknown;

  while (attempt <= retries) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method,
        body,
        headers: {
          "User-Agent": config.userAgent,
          Accept: "application/json",
          ...headers,
        },
        signal: controller.signal,
      });
      if (res.status === 429 || res.status >= 500) {
        const retryAfter = Number(res.headers.get("retry-after")) || 0;
        const backoff = retryAfter > 0 ? retryAfter * 1000 : 2 ** attempt * 500;
        await sleep(backoff);
        attempt += 1;
        continue;
      }
      if (!res.ok) {
        throw new HttpError(res.status, url, `HTTP ${res.status} ${res.statusText} for ${url}`);
      }
      return res;
    } catch (err) {
      lastError = err;
      if (err instanceof HttpError && err.status < 500) throw err;
      if (attempt === retries) break;
      await sleep(2 ** attempt * 500);
      attempt += 1;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`fetch failed: ${url}`);
}

export async function fetchJson<T>(url: string, init: HttpInit = {}): Promise<T> {
  const res = await request(url, init);
  return (await res.json()) as T;
}

export async function fetchText(url: string, init: HttpInit = {}): Promise<string> {
  const res = await request(url, { ...init, headers: { Accept: "*/*", ...init.headers } });
  return res.text();
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
