import Fixture from "@/content/tools/graphify.mdx";

/**
 * TEMPORARY — Phase 1 smoke test only.
 *
 * Proves the MDX pipeline compiles and renders, and that remark-frontmatter is
 * keeping the YAML block out of the body. Delete in Phase 2, when real routes
 * arrive and lib/content.ts owns entry rendering.
 *
 * The fixture it renders is status: draft. Once Phase 2's published guard is in
 * place this route must stop rendering it — which is the first real test of
 * guard 1, not an afterthought.
 */
export default function RenderCheck() {
  return (
    <main className="mx-auto max-w-2xl p-8">
      <Fixture />
    </main>
  );
}
