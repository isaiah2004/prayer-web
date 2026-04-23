import sanitizeHtml from "sanitize-html"

const allowedTags = [
  "p",
  "br",
  "strong",
  "em",
  "s",
  "u",
  "h2",
  "h3",
  "ul",
  "ol",
  "li",
  "blockquote",
  "code",
  "pre",
  "hr",
]

export function sanitizeRequestHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags,
    allowedAttributes: {},
    allowedSchemes: [],
    disallowedTagsMode: "discard",
  }).trim()
}
