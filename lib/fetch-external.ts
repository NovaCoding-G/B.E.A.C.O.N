import { SITE } from "@/lib/site";

const DEFAULT_HEADERS: HeadersInit = {
  Accept: "application/json, text/plain;q=0.9, */*;q=0.8",
  "User-Agent": `BEACON/${SITE.version} (+${SITE.githubRepo}; ${SITE.email})`,
};

/** Transient statuses worth retrying for idempotent requests. */
const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

/** Cap for Retry-After (and date-based) delays. */
export const MAX_RETRY_AFTER_MS = 5_000;

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

function isIdempotentMethod(method: string | undefined): boolean {
  const m = (method ?? "GET").toUpperCase();
  return m === "GET" || m === "HEAD";
}

function isRetryableStatus(status: number): boolean {
  return RETRYABLE_STATUSES.has(status);
}

/** Parse Retry-After (seconds or HTTP-date), clamped to MAX_RETRY_AFTER_MS. */
export function parseRetryAfterMs(response: Response): number | undefined {
  const raw = response.headers.get("Retry-After");
  if (!raw) return undefined;

  const asSeconds = Number(raw);
  if (Number.isFinite(asSeconds) && asSeconds >= 0) {
    return Math.min(asSeconds * 1000, MAX_RETRY_AFTER_MS);
  }

  const asDate = Date.parse(raw);
  if (!Number.isNaN(asDate)) {
    return Math.min(Math.max(0, asDate - Date.now()), MAX_RETRY_AFTER_MS);
  }

  return undefined;
}

function delayBeforeRetry(attempt: number, response?: Response): number {
  const fromHeader = response ? parseRetryAfterMs(response) : undefined;
  if (fromHeader !== undefined) return fromHeader;
  return 400 * (attempt + 1);
}

/** Compose per-attempt timeout with an optional caller AbortSignal. */
function composeAbortSignal(
  timeoutSignal: AbortSignal,
  callerSignal?: AbortSignal,
): AbortSignal {
  if (!callerSignal) return timeoutSignal;
  return AbortSignal.any([timeoutSignal, callerSignal]);
}

/** Drain/cancel unused bodies so undici can reuse sockets before retry/throw. */
async function releaseResponseBody(response: Response): Promise<void> {
  try {
    await response.body?.cancel();
  } catch {
    // Best-effort: body may already be locked or consumed.
  }
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
  const callerSignal = requestInit.signal ?? undefined;
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (callerSignal?.aborted) {
      const abortError = new Error("This operation was aborted");
      abortError.name = "AbortError";
      throw normalizeFetchError(
        callerSignal.reason instanceof Error
          ? callerSignal.reason
          : abortError,
      );
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const signal = composeAbortSignal(controller.signal, callerSignal);

    try {
      const response = await fetch(url, {
        ...requestInit,
        headers: {
          ...DEFAULT_HEADERS,
          ...(requestInit.headers ?? {}),
        },
        signal,
      });

      clearTimeout(timer);

      const canRetryHttp =
        !response.ok &&
        isIdempotentMethod(
          typeof requestInit.method === "string"
            ? requestInit.method
            : undefined,
        ) &&
        isRetryableStatus(response.status) &&
        attempt < retries;

      if (canRetryHttp) {
        lastError = new Error(
          `HTTP ${response.status} after ${attempt + 1} attempts`,
        );
        await releaseResponseBody(response);
        await sleep(delayBeforeRetry(attempt, response));
        continue;
      }

      if (
        !response.ok &&
        isRetryableStatus(response.status) &&
        attempt >= retries &&
        isIdempotentMethod(
          typeof requestInit.method === "string"
            ? requestInit.method
            : undefined,
        )
      ) {
        await releaseResponseBody(response);
        throw new Error(
          `HTTP ${response.status} after ${attempt + 1} attempts`,
        );
      }

      return response;
    } catch (error) {
      clearTimeout(timer);

      // Caller cancellation must not be retried.
      if (callerSignal?.aborted) {
        throw normalizeFetchError(error);
      }

      // Exhausted-retry HTTP errors thrown above — rethrow as-is.
      if (
        error instanceof Error &&
        /^HTTP \d{3} after \d+ attempts$/.test(error.message)
      ) {
        throw error;
      }

      lastError = normalizeFetchError(error);

      if (attempt < retries) {
        await sleep(delayBeforeRetry(attempt));
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
