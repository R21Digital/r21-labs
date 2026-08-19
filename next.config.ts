import type { NextConfig } from "next";
import createMDX from "@next/mdx";

const nextConfig: NextConfig = {
  pageExtensions: ["ts", "tsx", "md", "mdx"],
};

// Plugins are named as STRINGS, not imported functions. Turbopack serializes
// loader options across a worker boundary and a function reference cannot make
// that trip — passing `remarkFrontmatter` directly fails the build with
// "does not have serializable options".
//
// remark-frontmatter parses the YAML block and keeps it OUT of the rendered
// body. The values are read from disk by gray-matter in lib/content.ts, so the
// guards can reject an entry without compiling its MDX first.
const withMDX = createMDX({
  options: {
    remarkPlugins: [["remark-frontmatter"]],
  },
});

export default withMDX(nextConfig);
