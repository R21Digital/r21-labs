/**
 * A JSON-LD block.
 *
 * Structured data is how a crawler learns what KIND of thing a page is without
 * inferring it from prose — which matters more here than on most sites, because
 * spec §1 goal 2 is AI citability and an assistant deciding whether to quote a
 * page benefits from knowing it describes software with a named licence.
 *
 * 🔴 `JSON.stringify` is not sufficient escaping on its own. A `<` inside any
 * string value — a licence expression, a title, a body excerpt — closes the
 * script tag early and the rest of the payload lands in the DOM as markup.
 * Escaping the two characters that can open a tag is the standard fix and it
 * leaves the JSON valid, since `<` parses back to `<`.
 */
export default function JsonLd({ data }: { data: Record<string, unknown> }) {
  const json = JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");

  return (
    <script
      type="application/ld+json"
      // The content is built from our own content files, and the escaping above
      // covers the script-breakout case that makes this API dangerous.
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
