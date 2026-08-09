import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchExternal,
  fetchExternalJson,
  MAX_RETRY_AFTER_MS,
  parseRetryAfterMs,
} from "@/lib/fetch-external";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function statusResponse(
  status: number,
  headers?: Record<string, string>,
): Response {
  return new Response(null, { status, headers });
}

describe("fetchExternal HTTP retries", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("503 then 200 succeeds with two fetch calls", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(statusResponse(503))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));

    const pending = fetchExternalJson("https://example.com/data", {
      retries: 2,
      timeoutMs: 100,
    });
    const settled = expect(pending).resolves.toEqual({ ok: true });
    await vi.runAllTimersAsync();
    await settled;
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("429 then 200 honors a bounded Retry-After delay", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(statusResponse(429, { "Retry-After": "2" }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));

    const pending = fetchExternalJson("https://example.com/data", {
      retries: 2,
      timeoutMs: 5_000,
    });
    const settled = expect(pending).resolves.toEqual({ ok: true });

    await vi.advanceTimersByTimeAsync(1_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1_000);
    await settled;
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("HTTP 400 is attempted once", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(statusResponse(400));

    const pending = fetchExternalJson("https://example.com/data", {
      retries: 2,
      timeoutMs: 100,
    });
    const settled = expect(pending).rejects.toThrow(/HTTP 400/);
    await vi.runAllTimersAsync();
    await settled;
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("exhausted 503 responses report final status and attempt count", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(statusResponse(503))
      .mockResolvedValueOnce(statusResponse(503))
      .mockResolvedValueOnce(statusResponse(503));

    const pending = fetchExternalJson("https://example.com/data", {
      retries: 2,
      timeoutMs: 100,
    });
    const settled = expect(pending).rejects.toThrow(
      /HTTP 503 after 3 attempts/,
    );
    await vi.runAllTimersAsync();
    await settled;
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("caller abort prevents subsequent attempts", async () => {
    const fetchMock = vi.mocked(fetch);
    const controller = new AbortController();

    fetchMock.mockImplementationOnce(async () => {
      controller.abort();
      const err = new Error("This operation was aborted");
      err.name = "AbortError";
      throw err;
    });

    await expect(
      fetchExternalJson("https://example.com/data", {
        retries: 2,
        timeoutMs: 5_000,
        signal: controller.signal,
      }),
    ).rejects.toThrow(/aborted/i);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("timeout still aborts when the caller also passes a signal", async () => {
    const fetchMock = vi.mocked(fetch);
    const caller = new AbortController();

    fetchMock.mockImplementationOnce((_url, init) => {
      return new Promise((_resolve, reject) => {
        const signal = init?.signal;
        if (!signal) {
          reject(new Error("missing signal"));
          return;
        }
        signal.addEventListener(
          "abort",
          () => {
            const err = new Error("This operation was aborted");
            err.name = "AbortError";
            reject(err);
          },
          { once: true },
        );
      });
    });

    const pending = fetchExternal("https://example.com/hang", {
      retries: 0,
      timeoutMs: 50,
      signal: caller.signal,
    });
    const settled = expect(pending).rejects.toThrow(/aborted/i);
    await vi.advanceTimersByTimeAsync(50);
    await settled;
    expect(caller.signal.aborted).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("cancels retryable response bodies before the next attempt", async () => {
    const fetchMock = vi.mocked(fetch);
    const cancel = vi.fn().mockResolvedValue(undefined);
    const body = {
      cancel,
      getReader: () => {
        throw new Error("body should be cancelled, not read");
      },
    } as unknown as ReadableStream<Uint8Array>;

    fetchMock
      .mockResolvedValueOnce(
        new Response(body, {
          status: 503,
          headers: { "Content-Type": "text/plain" },
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ ok: true }));

    const pending = fetchExternalJson("https://example.com/data", {
      retries: 2,
      timeoutMs: 100,
    });
    const settled = expect(pending).resolves.toEqual({ ok: true });
    await vi.runAllTimersAsync();
    await settled;
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("parseRetryAfterMs", () => {
  it("clamps Retry-After seconds to MAX_RETRY_AFTER_MS", () => {
    const res = statusResponse(429, { "Retry-After": "120" });
    expect(parseRetryAfterMs(res)).toBe(MAX_RETRY_AFTER_MS);
  });

  it("parses small Retry-After second values", () => {
    const res = statusResponse(429, { "Retry-After": "2" });
    expect(parseRetryAfterMs(res)).toBe(2_000);
  });
});
