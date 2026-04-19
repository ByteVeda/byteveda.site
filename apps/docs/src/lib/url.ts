export function isExternalUrl(href: string): boolean {
  return /^(?:https?:)?\/\//.test(href);
}
