import { describe, expect, it } from "vitest";
import { buildListenLinks } from "@/components/sb/listen";

describe("buildListenLinks", () => {
  it("builds YouTube + YouTube Music search URLs", () => {
    const links = buildListenLinks("Coldplay", "Yellow");
    expect(links.query).toBe("Coldplay - Yellow");
    expect(links.youtube).toBe(
      "https://www.youtube.com/results?search_query=Coldplay%20-%20Yellow+official+audio",
    );
    expect(links.youtubeMusic).toBe(
      "https://music.youtube.com/search?q=Coldplay%20-%20Yellow",
    );
  });

  it("trims and encodes special characters", () => {
    const links = buildListenLinks("  Beyoncé ", "Halo & Heaven ");
    expect(links.youtube).toContain(encodeURIComponent("Beyoncé - Halo & Heaven"));
    expect(links.youtubeMusic).toContain(encodeURIComponent("Beyoncé - Halo & Heaven"));
  });
});
