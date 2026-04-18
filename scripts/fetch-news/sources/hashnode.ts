import { config } from "../config";
import { fetchJson } from "../http";
import { toLabels } from "../labels";
import type { NewsItem, SourceAdapter } from "../types";
import { containsMention, stableId, truncate } from "../util";

type HashnodePost = {
  id: string;
  title: string;
  url: string;
  brief: string | null;
  publishedAt: string;
  reactionCount: number;
  author: { name: string | null; username: string };
  tags: { slug: string }[] | null;
};

type TagResponse = {
  data: {
    tag: {
      name: string;
      posts: { edges: { node: HashnodePost }[] };
    } | null;
  } | null;
  errors?: { message: string }[];
};

const QUERY = `
  query TagPosts($slug: String!, $first: Int!) {
    tag(slug: $slug) {
      name
      posts(first: $first, filter: { sortBy: recent }) {
        edges {
          node {
            id
            title
            url
            brief
            publishedAt
            reactionCount
            author { name username }
            tags { slug }
          }
        }
      }
    }
  }
`;

async function fetchTag(slug: string): Promise<HashnodePost[]> {
  const body = JSON.stringify({
    query: QUERY,
    variables: { slug, first: config.hashnode.perTagLimit },
  });
  const data = await fetchJson<TagResponse>("https://gql.hashnode.com/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  if (data.errors?.length) throw new Error(data.errors[0].message);
  return data.data?.tag?.posts.edges.map((e) => e.node) ?? [];
}

function normalize(post: HashnodePost): NewsItem {
  const title = post.title.trim();
  const brief = post.brief?.trim() ?? "";
  const author = post.author.name?.trim() || post.author.username;
  const tags = post.tags?.map((t) => t.slug) ?? [];
  return {
    id: stableId("hashnode", post.id),
    kind: "article",
    source: "hashnode",
    title,
    url: post.url,
    excerpt: brief ? truncate(brief, 200) : null,
    author,
    publishedAt: post.publishedAt,
    score: post.reactionCount,
    tags,
    labels: toLabels(tags),
    mentionsByteveda: containsMention(`${title} ${brief}`),
  };
}

export const hashnodeAdapter: SourceAdapter = {
  name: "hashnode",
  source: "hashnode",
  async fetch() {
    const settled = await Promise.allSettled(config.hashnode.tagSlugs.map(fetchTag));
    const posts = settled.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
    return posts.filter((p) => p.reactionCount >= config.hashnode.minReactions).map(normalize);
  },
};
