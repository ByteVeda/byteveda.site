/**
 * A JSON-LD block.
 *
 * `JSON.stringify` does not escape `<`, so a value containing `</script>` would
 * close the tag and have everything after it parsed as markup. Escaping it to
 * the equivalent JSON unicode escape keeps the payload valid JSON and inert as
 * HTML — the same treatment Next gives its own inline state. Every
 * structured-data block on the site goes through here so no page has to
 * remember to do it.
 *
 * The values are ours (frontmatter and site config), not visitor input, but a
 * post title is still stored content: the escape is what makes that safe by
 * construction rather than by convention.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");

  return (
    <script
      type="application/ld+json"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD has to be injected as raw JSON, and `<` is escaped above so the payload cannot close the tag
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
