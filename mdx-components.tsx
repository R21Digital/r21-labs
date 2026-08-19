import type { MDXComponents } from "mdx/types";

// Required by @next/mdx in the App Router. Element styling arrives with the
// playbook template in Phase 4 — this is the wiring only.
export function useMDXComponents(components: MDXComponents): MDXComponents {
  return { ...components };
}
