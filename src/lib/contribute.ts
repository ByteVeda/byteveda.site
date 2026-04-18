import { site } from "./site";

export type Maintainer = {
  login: string;
  name: string;
  role: string;
};

export const maintainers: Maintainer[] = [
  {
    login: "ByteVeda",
    name: "ByteVeda Core",
    role: "Rust cores, language bindings, release engineering",
  },
];

export type ContributeStep = {
  number: string;
  title: string;
  description: string;
  command?: string;
};

export const contributeSteps: ContributeStep[] = [
  {
    number: "01",
    title: "Pick a project",
    description: "Clone any repo from the ByteVeda organization and jump into its README.",
    command: `git clone ${site.githubUrl}/<repo>.git`,
  },
  {
    number: "02",
    title: "Build it locally",
    description: "Every repo ships a one-command setup — Rust core, language bindings, and tests.",
    command: "cargo test && just test-bindings",
  },
  {
    number: "03",
    title: "Open a pull request",
    description:
      "Push a branch, open a PR — we review within a few days and help you get it merged.",
    command: "git push -u origin my-change",
  },
];

export const contributeGuideUrl = `${site.githubUrl}/.github/blob/main/CONTRIBUTING.md`;
export const discussionsUrl = `${site.githubUrl}/.github/discussions`;

export function avatarUrl(login: string, size = 128): string {
  return `https://github.com/${login}.png?size=${size}`;
}

export function profileUrl(login: string): string {
  return `https://github.com/${login}`;
}
