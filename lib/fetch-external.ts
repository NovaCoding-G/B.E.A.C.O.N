import { SITE } from "@/lib/site";

const DEFAULT_HEADERS: HeadersInit = {
  Accept: "application/json, text/plain;q=0.9, */*;q=0.8",
  "User-Agent": `BEACON/${SITE.version} (+${SITE.githubRepo}; ${SITE.email})`,
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeFetchError(error: unknown): Error {
  if (!(error instanceof Error)) {
    return new Error("fetch failed");
  }

  const cause = error.cause as { message?: string; code?: string } | undefined;

  if (cause?.code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE") {
    return new Error(
      "SSL certificate verification failed — run via `npm run dev` (sets NODE_OPTIONS=--use-system-ca on Windows)",
      { cause: error },
    );
  }

  if (cause?.message) {
    return new Error(`${error.message}: ${cause.message}`, { cause: error });
  }

  return error;
}

export interface FetchExternalOptions extends RequestInit {
  timeoutMs?: number;
  retries?: number;
}

export async function fetchExternal(
  url: string,
  options: FetchExternalOptions = {},
): Promise<Response> {
  const { timeoutMs = 30_000, retries = 2, ...requestInit } = options;
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...requestInit,
        headers: {
          ...DEFAULT_HEADERS,
          ...(requestInit.headers ?? {}),
        },
        signal: requestInit.signal ?? controller.signal,
      });

      clearTimeout(timer);
      return response;
    } catch (error) {
      clearTimeout(timer);
      lastError = normalizeFetchError(error);

      if (attempt < retries) {
        await sleep(400 * (attempt + 1));
      }
    }
  }

  throw lastError ?? new Error("fetch failed");
}

export async function fetchExternalText(
  url: string,
  options?: FetchExternalOptions,
): Promise<string> {
  const response = await fetchExternal(url, options);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.text();
}

export async function fetchExternalJson(
  url: string,
  options?: FetchExternalOptions,
): Promise<unknown> {
  const response = await fetchExternal(url, options);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
}
