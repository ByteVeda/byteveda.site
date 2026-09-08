import { describe, expect, it } from "vitest";
import { parseCratesDownloads, parseCratesTotal } from "./crates";
import { maven } from "./maven";
import { parseNpmRange } from "./npm";
import { parsePepyTotal, parsePypistats } from "./pypi";

describe("parsePypistats", () => {
  it("sums the categories reported for a day", () => {
    expect(
      parsePypistats({
        data: [
          { category: "without_mirrors", date: "2026-09-01", downloads: 120 },
          { category: "with_mirrors", date: "2026-09-01", downloads: 30 },
          { category: "without_mirrors", date: "2026-09-02", downloads: 90 },
        ],
      }),
    ).toEqual([
      { day: "2026-09-01", downloads: 150 },
      { day: "2026-09-02", downloads: 90 },
    ]);
  });

  it("returns days in ascending order whatever the input order", () => {
    const points = parsePypistats({
      data: [
        { category: "x", date: "2026-09-03", downloads: 1 },
        { category: "x", date: "2026-09-01", downloads: 2 },
      ],
    });
    expect(points.map((point) => point.day)).toEqual(["2026-09-01", "2026-09-03"]);
  });

  it("skips malformed and negative rows rather than recording them", () => {
    expect(
      parsePypistats({
        data: [
          { category: "x", date: "2026-09-01", downloads: -5 },
          { category: "x", date: "", downloads: 10 },
          { category: "x", date: "2026-09-02", downloads: 7 },
        ],
      }),
    ).toEqual([{ day: "2026-09-02", downloads: 7 }]);
  });

  it("handles an empty payload", () => {
    expect(parsePypistats({ data: [] })).toEqual([]);
  });
});

describe("parsePepyTotal", () => {
  it("reads the lifetime figure", () => {
    expect(parsePepyTotal({ total_downloads: 142908 })).toEqual({
      value: 142908,
      source: "pepy.tech",
    });
  });

  it("returns nothing when the field is missing or nonsense", () => {
    expect(parsePepyTotal({})).toBeUndefined();
    expect(parsePepyTotal({ total_downloads: -1 })).toBeUndefined();
  });
});

describe("parseNpmRange", () => {
  it("maps the range payload to daily points", () => {
    expect(
      parseNpmRange({
        downloads: [
          { day: "2026-09-01", downloads: 40 },
          { day: "2026-09-02", downloads: 55 },
        ],
      }),
    ).toEqual([
      { day: "2026-09-01", downloads: 40 },
      { day: "2026-09-02", downloads: 55 },
    ]);
  });

  it("tolerates a missing downloads array", () => {
    expect(parseNpmRange({})).toEqual([]);
  });
});

describe("parseCratesDownloads", () => {
  it("adds extra_downloads to the per-version rows for the same day", () => {
    expect(
      parseCratesDownloads({
        version_downloads: [
          { date: "2026-09-01", downloads: 10 },
          { date: "2026-09-01", downloads: 5 },
        ],
        meta: { extra_downloads: [{ date: "2026-09-01", downloads: 3 }] },
      }),
    ).toEqual([{ day: "2026-09-01", downloads: 18 }]);
  });

  it("works when there is no extra_downloads bucket", () => {
    expect(
      parseCratesDownloads({ version_downloads: [{ date: "2026-09-02", downloads: 4 }] }),
    ).toEqual([{ day: "2026-09-02", downloads: 4 }]);
  });

  it("handles an empty payload", () => {
    expect(parseCratesDownloads({})).toEqual([]);
  });
});

describe("parseCratesTotal", () => {
  it("reads the lifetime figure", () => {
    expect(parseCratesTotal({ crate: { downloads: 3001 } })).toEqual({
      value: 3001,
      source: "crates.io",
    });
  });

  it("returns nothing when the crate is absent", () => {
    expect(parseCratesTotal({})).toBeUndefined();
  });
});

describe("maven", () => {
  it("reports unsupported rather than failing, because there is no such API", async () => {
    const result = await maven.fetch("org.byteveda.agenteval:agenteval-junit5");
    expect(result.kind).toBe("unsupported");
  });
});
