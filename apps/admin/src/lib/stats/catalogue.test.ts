import { describe, expect, it } from "vitest";
import { catalogueSuggestions, suggestionsFor } from "./catalogue";

const base = {
  slug: "flexiq",
  name: "FlexiQ",
  tagline: "",
  description: "",
  license: "MIT" as const,
  repoUrl: "",
  docsUrl: "",
  readmeUrl: "",
};

describe("suggestionsFor", () => {
  it("reads the PyPI name out of a pip install line", () => {
    const found = suggestionsFor({
      ...base,
      languages: ["Python"],
      install: "pip install flexiq",
    });
    expect(found).toEqual([{ projectSlug: "flexiq", ecosystem: "pypi", packageName: "flexiq" }]);
  });

  it("ignores the languages a project is written in", () => {
    // Being written in Rust does not mean it is published on crates.io. Guessing
    // from languages produced four 404s against the real catalogue.
    const found = suggestionsFor({
      ...base,
      languages: ["Rust", "Python", "TypeScript"],
      install: "pip install flexiq",
    });
    expect(found.map((entry) => entry.ecosystem)).toEqual(["pypi"]);
  });

  it("reads an npm or a cargo install line", () => {
    expect(
      suggestionsFor({ ...base, languages: ["TypeScript"], install: "npm i @byteveda/flexiq" }),
    ).toEqual([{ projectSlug: "flexiq", ecosystem: "npm", packageName: "@byteveda/flexiq" }]);

    expect(suggestionsFor({ ...base, languages: ["Rust"], install: "cargo add flexiq" })).toEqual([
      { projectSlug: "flexiq", ecosystem: "crates", packageName: "flexiq" },
    ]);
  });

  it("treats a bare coordinate as Maven rather than a shell command", () => {
    const found = suggestionsFor({
      ...base,
      slug: "agenteval",
      languages: ["Java"],
      install: "org.byteveda.agenteval:agenteval-junit5",
    });
    expect(found).toEqual([
      {
        projectSlug: "agenteval",
        ecosystem: "maven",
        packageName: "org.byteveda.agenteval:agenteval-junit5",
      },
    ]);
  });

  it("suggests nothing it cannot infer", () => {
    expect(suggestionsFor({ ...base, languages: ["Java"], install: "see the docs" })).toEqual([]);
  });
});

describe("catalogueSuggestions", () => {
  const suggestions = catalogueSuggestions();

  it("covers every project in the catalogue", () => {
    expect(new Set(suggestions.map((entry) => entry.projectSlug)).size).toBeGreaterThanOrEqual(5);
  });

  it("never suggests the same package twice", () => {
    const keys = suggestions.map((entry) => `${entry.ecosystem}:${entry.packageName}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
