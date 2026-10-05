import { describe, expect, it } from "vitest";
import { computeChart, DEFAULT_WEIGHTS, movement, momentum } from "./index";

const m = (songId: string, v: number, up = 0) => ({ songId, streaming: v, radio: v, social: v, search: v, peopleUp: up, peopleDown: 0 });

describe("chart engine", () => {
  it("ranks by weighted score and normalises leader to 100", () => {
    const out = computeChart([m("a", 10, 10), m("b", 5, 5)], new Map(), DEFAULT_WEIGHTS);
    expect(out.at(0)?.songId).toBe("a");
    expect(out.at(0)?.songboardScore).toBe(100);
    expect(out.at(1)?.songboardScore).toBe(50);
  });
  it("people votes can flip close races", () => {
    const out = computeChart([m("a", 10, 0), m("b", 9.5, 100)], new Map(), DEFAULT_WEIGHTS);
    expect(out.at(0)?.songId).toBe("b");
  });
  it("respects configurable weights", () => {
    const a = { ...m("a", 0), streaming: 100 };
    const b = { ...m("b", 0), radio: 100 };
    const out = computeChart([a, b], new Map(), { streaming: 0, radio: 100, people: 0, social: 0, search: 0 });
    expect(out.at(0)?.songId).toBe("b");
  });
  it("tracks previous rank, peak and weeks", () => {
    const prev = new Map([["a", { rank: 3, songboardScore: 80, peakRank: 2, weeksOnChart: 4 }]]);
    const [e] = computeChart([m("a", 1)], prev, DEFAULT_WEIGHTS);
    expect(e).toMatchObject({ rank: 1, prevRank: 3, peakRank: 1, weeksOnChart: 5 });
  });
  it("movement + momentum helpers", () => {
    expect(movement(2, 5, 3)).toEqual({ kind: "up", delta: 3 });
    expect(movement(1, null, 1).kind).toBe("new");
    expect(movement(1, null, 4).kind).toBe("re");
    expect(momentum(60, undefined)).toBe(60);
    expect(momentum(55, 50)).toBe(70);
  });
});
