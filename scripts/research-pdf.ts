/**
 * Local PDF export for research reports. NOT part of `prebuild`.
 *
 * Prints every published report page, in both languages, to
 * `public/research/<slug>/<slug>.<lang>.pdf` (the path the citation block
 * links), and next to each one a `<slug>.<lang>.pdf.json` manifest with the
 * SHA-256 of the sources it was printed from (that language's .mdx and every
 * `dataFiles` entry). The PDFs are committed: Vercel's build image has no
 * browser, so they are build inputs, and tests/research-pdf.test.ts is the gate
 * that a published report has them and that they match the current sources.
 * It cannot run in `prebuild` anyway: it needs a finished build to serve.
 *
 * Usage: `npm run build && npm run research:pdf`
 *   --base <url>   print from an already-running server instead of starting
 *                  `next start` on port 3999. That server must serve the
 *                  current build: the manifest records this checkout's
 *                  sources, whatever the server renders.
 *
 * Exits 1 when a page is not 200 or the server never comes up. The PDF is the
 * page's print rendering, so `@media print` in app/globals.css decides how it
 * looks.
 */
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { chromium } from "playwright";

import { getPublishedReports, reportPath, type Lang } from "../lib/research";
import { pdfManifestFor, researchPdfManifestPath, researchPdfPath } from "../lib/research-files";

const PORT = 3999;
const STARTUP_TIMEOUT_MS = 60_000;

function baseFromArgs(): string | null {
  const index = process.argv.indexOf("--base");
  if (index === -1) return null;
  const value = process.argv[index + 1];
  if (!value) {
    console.error("--base needs a URL, e.g. --base http://localhost:3000");
    process.exit(1);
  }
  return value.replace(/\/+$/, "");
}

async function answers(url: string): Promise<boolean> {
  try {
    await fetch(url, { signal: AbortSignal.timeout(2_000) });
    return true;
  } catch {
    return false;
  }
}

function startServer(): ChildProcess {
  const next = path.join(process.cwd(), "node_modules", "next", "dist", "bin", "next");
  return spawn(process.execPath, [next, "start", "-p", String(PORT)], {
    stdio: "ignore",
    // Own process group on POSIX so the whole tree can be killed in one call.
    detached: process.platform !== "win32",
  });
}

function stopServer(child: ChildProcess): void {
  if (child.pid === undefined) return;
  if (process.platform === "win32") {
    // A plain child.kill() can leave the node server behind on Windows.
    spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
  } else {
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {
      child.kill("SIGTERM");
    }
  }
}

async function waitUntilUp(base: string, child: ChildProcess): Promise<void> {
  const deadline = Date.now() + STARTUP_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(
        `next start exited with code ${child.exitCode} before answering. Is port ${PORT} free, and did \`npm run build\` finish?`,
      );
    }
    if (await answers(base)) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`next start did not answer on ${base} within ${STARTUP_TIMEOUT_MS / 1000}s`);
}

async function main(): Promise<number> {
  const langs: Lang[] = ["en", "es"];
  const targets = langs.flatMap((lang) =>
    getPublishedReports(lang).map((report) => ({ report })),
  );
  if (targets.length === 0) {
    console.log("research pdf: no published reports, nothing to print");
    return 0;
  }

  const givenBase = baseFromArgs();
  if (givenBase) {
    console.warn(
      `research pdf: printing from ${givenBase}. That server must serve the CURRENT build ` +
        `of this checkout; the .pdf.json manifests record today's sources whatever it serves.`,
    );
  }
  const base = givenBase ?? `http://localhost:${PORT}`;
  const server = givenBase ? null : startServer();
  let failed = 0;

  try {
    if (server) await waitUntilUp(base, server);

    const browser = await chromium.launch();
    try {
      for (const { report } of targets) {
        const url = `${base}${reportPath(report)}`;
        const page = await browser.newPage();
        try {
          const response = await page.goto(url, { waitUntil: "networkidle" });
          const status = response?.status() ?? 0;
          if (status !== 200) {
            console.error(`FAIL ${url} returned ${status}`);
            failed += 1;
            continue;
          }
          await page.emulateMedia({ media: "print" });
          const out = researchPdfPath(report);
          fs.mkdirSync(path.dirname(out), { recursive: true });
          await page.pdf({ path: out, format: "Letter", printBackground: true });
          // What this PDF was printed from, so tests/research-pdf.test.ts can
          // tell when the report or its data changed after printing.
          const manifest = researchPdfManifestPath(report);
          fs.writeFileSync(manifest, `${JSON.stringify(pdfManifestFor(report), null, 2)}\n`);
          console.log(`wrote ${path.relative(process.cwd(), out).split(path.sep).join("/")} (+ .json)`);
        } finally {
          await page.close();
        }
      }
    } finally {
      await browser.close();
    }
  } finally {
    if (server) stopServer(server);
  }

  if (failed > 0) {
    console.error(`\nresearch pdf: ${failed} page${failed === 1 ? "" : "s"} did not return 200`);
    return 1;
  }
  return 0;
}

main().then(
  (code) => process.exit(code),
  (error) => {
    console.error(`\nresearch pdf failed: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  },
);
