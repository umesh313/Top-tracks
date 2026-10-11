import { describe, expect, it } from "vitest";
import { parseLrc } from "./lyrics.functions";

describe("parseLrc", () => {
  it("parses timestamps with centiseconds and milliseconds", () => {
    const lines = parseLrc("[00:17.12] Hello\n[03:20.310] World");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toEqual({ time: 17.12, text: "Hello" });
    expect(lines[1]?.time).toBeCloseTo(200.31, 2);
  });

  it("expands multiple timestamps on one line and sorts", () => {
    const lines = parseLrc("[00:10.00][00:05.00] Repeat");
    expect(lines).toEqual([
      { time: 5, text: "Repeat" },
      { time: 10, text: "Repeat" },
    ]);
  });

  it("drops metadata tags and blank lines", () => {
    const lines = parseLrc("[ti:Title]\n[ar:Artist]\n\n[00:01.00] First");
    expect(lines).toEqual([{ time: 1, text: "First" }]);
  });
});
