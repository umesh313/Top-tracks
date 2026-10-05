import { afterEach, describe, expect, it, vi } from "vitest";
import { requestCover } from "./cover-client";

function okResponse(artworkUrl100: string | null) {
  return {
    ok: true,
    json: () => Promise.resolve({ results: artworkUrl100 ? [{ artworkUrl100 }] : [] }),
  } as Response;
}

describe("requestCover", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("resolves artwork, upgrades the size and caches per track", async () => {
    const fetchMock = vi.fn(() => Promise.resolve(okResponse("https://example.test/100x100bb.jpg")));
    vi.stubGlobal("fetch", fetchMock);

    const first = await requestCover("Artist One", "Song One");
    expect(first).toBe("https://example.test/600x600bb.jpg");

    const second = await requestCover("Artist One", "Song One");
    expect(second).toBe("https://example.test/600x600bb.jpg");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("deduplicates concurrent requests for the same track", async () => {
    const fetchMock = vi.fn(
      () => new Promise<Response>((resolve) => setTimeout(() => resolve(okResponse("https://example.test/a100x100bb.jpg")), 20)),
    );
    vi.stubGlobal("fetch", fetchMock);

    const [a, b] = await Promise.all([requestCover("Artist Two", "Song Two"), requestCover("Artist Two", "Song Two")]);
    expect(a).toBe("https://example.test/a600x600bb.jpg");
    expect(b).toBe("https://example.test/a600x600bb.jpg");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("caches known misses so empty results are never refetched", async () => {
    const fetchMock = vi.fn(() => Promise.resolve(okResponse(null)));
    vi.stubGlobal("fetch", fetchMock);

    expect(await requestCover("Nobody Famous", "Imaginary Song")).toBeNull();
    expect(await requestCover("Nobody Famous", "Imaginary Song")).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not cache network errors — a later call retries", async () => {
    const failing = vi.fn(() => Promise.reject(new Error("offline")));
    vi.stubGlobal("fetch", failing);
    expect(await requestCover("Flaky Artist", "Flaky Song")).toBeNull();

    const recovered = vi.fn(() => Promise.resolve(okResponse("https://example.test/b100x100bb.jpg")));
    vi.stubGlobal("fetch", recovered);
    expect(await requestCover("Flaky Artist", "Flaky Song")).toBe("https://example.test/b600x600bb.jpg");
    expect(recovered).toHaveBeenCalledTimes(1);
  });

  it("returns null when iTunes has no matching song", async () => {
    const fetchMock = vi.fn(() => Promise.resolve(okResponse(null)));
    vi.stubGlobal("fetch", fetchMock);
    expect(await requestCover("Obscure Act", "Unreleased B-Side")).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
