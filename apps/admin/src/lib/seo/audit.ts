import { headings, isInternalLink, links, wordCount } from "./text";

export type CheckStatus = "pass" | "warn" | "fail";

export type Check = {
  id: string;
  label: string;
  status: CheckStatus;
  /** What is true right now, and what to do about it. Never just "bad". */
  detail: string;
};

export type AuditInput = {
  title: string;
  description: string;
  slug: string;
  body: string;
  tags: string[];
  /** The term the post is meant to rank for, if one has been chosen. */
  primaryKeyword?: string;
};

/** Google truncates a title around 60 characters and rarely shows fewer than 30. */
const TITLE_MIN = 30;
const TITLE_MAX = 60;
const DESCRIPTION_MIN = 120;
const DESCRIPTION_MAX = 158;
const SLUG_MAX = 60;
const THIN_CONTENT = 300;

const SLUG_SHAPE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function contains(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

function titleCheck({ title }: AuditInput): Check {
  const length = title.trim().length;
  if (length === 0) {
    return { id: "title", label: "Title", status: "fail", detail: "Give the post a title." };
  }
  if (length < TITLE_MIN) {
    return {
      id: "title",
      label: "Title",
      status: "warn",
      detail: `${length} characters. Aim for ${TITLE_MIN}–${TITLE_MAX} so the result is not sparse.`,
    };
  }
  if (length > TITLE_MAX) {
    return {
      id: "title",
      label: "Title",
      status: "warn",
      detail: `${length} characters. Search results cut off around ${TITLE_MAX}.`,
    };
  }
  return { id: "title", label: "Title", status: "pass", detail: `${length} characters.` };
}

function descriptionCheck({ description }: AuditInput): Check {
  const length = description.trim().length;
  if (length === 0) {
    return {
      id: "description",
      label: "Meta description",
      status: "fail",
      detail: "Write one. Without it, search engines invent a snippet from the body.",
    };
  }
  if (length < DESCRIPTION_MIN || length > DESCRIPTION_MAX) {
    return {
      id: "description",
      label: "Meta description",
      status: "warn",
      detail: `${length} characters. ${DESCRIPTION_MIN}–${DESCRIPTION_MAX} is what fits.`,
    };
  }
  return {
    id: "description",
    label: "Meta description",
    status: "pass",
    detail: `${length} characters.`,
  };
}

function slugCheck({ slug }: AuditInput): Check {
  if (!slug) {
    return { id: "slug", label: "Slug", status: "fail", detail: "Set a slug before publishing." };
  }
  if (!SLUG_SHAPE.test(slug)) {
    return {
      id: "slug",
      label: "Slug",
      status: "fail",
      detail: "Use lowercase words separated by single hyphens.",
    };
  }
  if (slug.length > SLUG_MAX) {
    return {
      id: "slug",
      label: "Slug",
      status: "warn",
      detail: `${slug.length} characters. Shorter URLs travel better.`,
    };
  }
  return { id: "slug", label: "Slug", status: "pass", detail: `/blog/${slug}` };
}

function keywordCheck(input: AuditInput): Check[] {
  const keyword = input.primaryKeyword?.trim();
  if (!keyword) {
    return [
      {
        id: "keyword",
        label: "Primary keyword",
        status: "warn",
        detail: "Pick one from the suggestions to check the title and opening against it.",
      },
    ];
  }

  const opening = input.body.slice(0, 1200);
  return [
    {
      id: "keyword-title",
      label: "Keyword in title",
      status: contains(input.title, keyword) ? "pass" : "warn",
      detail: contains(input.title, keyword)
        ? `"${keyword}" is in the title.`
        : `Work "${keyword}" into the title if it fits naturally.`,
    },
    {
      id: "keyword-opening",
      label: "Keyword in opening",
      status: contains(opening, keyword) ? "pass" : "warn",
      detail: contains(opening, keyword)
        ? `"${keyword}" appears early.`
        : `Mention "${keyword}" in the first paragraph or two.`,
    },
  ];
}

function headingCheck({ body }: AuditInput): Check {
  const found = headings(body);
  if (found.length === 0) {
    return {
      id: "headings",
      label: "Headings",
      status: "warn",
      detail: "No headings. Long posts are much easier to scan with them.",
    };
  }

  // The page renders the title as the h1, so the body should start at h2.
  const topLevel = Math.min(...found.map((heading) => heading.level));
  if (topLevel < 2) {
    return {
      id: "headings",
      label: "Headings",
      status: "warn",
      detail: "The page title is already the h1. Start the body at h2.",
    };
  }

  let previous = topLevel;
  for (const heading of found) {
    if (heading.level > previous + 1) {
      return {
        id: "headings",
        label: "Headings",
        status: "warn",
        detail: `"${heading.text}" jumps from h${previous} to h${heading.level}.`,
      };
    }
    previous = heading.level;
  }

  return {
    id: "headings",
    label: "Headings",
    status: "pass",
    detail: `${found.length} heading${found.length === 1 ? "" : "s"}, properly nested.`,
  };
}

function linkCheck({ body }: AuditInput): Check {
  const internal = links(body).filter(isInternalLink).length;
  if (internal === 0) {
    return {
      id: "links",
      label: "Internal links",
      status: "warn",
      detail: "None. Link to a related post or a docs page.",
    };
  }
  return {
    id: "links",
    label: "Internal links",
    status: "pass",
    detail: `${internal} link${internal === 1 ? "" : "s"} to your own pages.`,
  };
}

function lengthCheck({ body }: AuditInput): Check {
  const words = wordCount(body);
  if (words === 0) {
    return { id: "length", label: "Length", status: "fail", detail: "The post is empty." };
  }
  if (words < THIN_CONTENT) {
    return {
      id: "length",
      label: "Length",
      status: "warn",
      detail: `${words} words. Under ${THIN_CONTENT} tends to read as a stub.`,
    };
  }
  return { id: "length", label: "Length", status: "pass", detail: `${words} words.` };
}

function tagCheck({ tags }: AuditInput): Check {
  if (tags.length === 0) {
    return {
      id: "tags",
      label: "Tags",
      status: "warn",
      detail: "Add one or two so the post groups with related writing.",
    };
  }
  return { id: "tags", label: "Tags", status: "pass", detail: tags.join(", ") };
}

/** Everything the panel shows, in the order it shows it. */
export function auditPost(input: AuditInput): Check[] {
  return [
    titleCheck(input),
    descriptionCheck(input),
    slugCheck(input),
    ...keywordCheck(input),
    headingCheck(input),
    linkCheck(input),
    lengthCheck(input),
    tagCheck(input),
  ];
}

/** A single number for the header. Warnings cost half of what failures cost. */
export function auditScore(checks: Check[]): number {
  if (checks.length === 0) return 0;
  const earned = checks.reduce((total, check) => {
    if (check.status === "pass") return total + 1;
    return check.status === "warn" ? total + 0.5 : total;
  }, 0);
  return Math.round((earned / checks.length) * 100);
}
