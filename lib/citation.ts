import { reportPath, type Report } from "./research";
import { SITE_URL } from "./site";

/**
 * Citation text for a report: an APA line and a BibTeX entry. Pure functions,
 * kept out of the component so they can be unit tested without rendering.
 *
 * `author` in frontmatter is "Person, Organization" ("Carlos Jimenez, R21
 * Digital"). Citation formats want those apart: APA lists the person as
 * "Jimenez, C.", and BibTeX reads a comma inside `author` as "Last, First", so
 * the whole string there would turn the organization into a first name.
 */

const MONTHS = {
  en: [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ],
  es: [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
  ],
};
const BIBTEX_MONTHS = [
  "jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec",
];

/** `YYYY-MM-DD` split without a Date, so the output cannot shift with the build machine's timezone. */
function parts(isoDate: string): { year: string; month: number; day: number } {
  const [year, month, day] = isoDate.split("-");
  return { year, month: Number(month), day: Number(day) };
}

function bibtexEscape(value: string): string {
  // "\\$1" is a backslash followed by the matched character. "\$1" in a JS
  // string is just "$1", which silently escapes nothing.
  return value.replace(/([&%#_$])/g, "\\$1");
}

export interface CitationAuthor {
  /** Last word of the person's name. */
  family: string;
  /** The words before it, possibly none. */
  given: string[];
  /** Text after the first comma, when there is one. */
  organization?: string;
}

/** "Carlos Jimenez, R21 Digital" → family Jimenez, given [Carlos], organization R21 Digital. */
export function parseAuthor(author: string): CitationAuthor {
  const comma = author.indexOf(",");
  const person = (comma === -1 ? author : author.slice(0, comma)).trim();
  const organization = comma === -1 ? "" : author.slice(comma + 1).trim();
  const words = person.split(/\s+/).filter(Boolean);
  return {
    family: words[words.length - 1] ?? person,
    given: words.slice(0, -1),
    ...(organization ? { organization } : {}),
  };
}

/** APA author: "Jimenez, C." ("Jimenez, C. A." for two given names). */
function apaAuthor({ family, given }: CitationAuthor): string {
  if (given.length === 0) return `${family}.`;
  return `${family}, ${given.map((name) => `${name[0].toUpperCase()}.`).join(" ")}`;
}

/** APA date: "(2026, November 10)" in English, "(2026, 10 de noviembre)" in Spanish. */
function apaDate(report: Report): string {
  const { year, month, day } = parts(report.publishedOn);
  const name = MONTHS[report.lang][month - 1];
  return report.lang === "es" ? `(${year}, ${day} de ${name})` : `(${year}, ${name} ${day})`;
}

/** A title that already ends in . ? or ! takes no added full stop. */
function closeTitle(title: string): string {
  return /[.?!]$/.test(title.trim()) ? title.trim() : `${title.trim()}.`;
}

/**
 * The APA line split at the URL, so the component can render the URL as a
 * link. `apaLine` is the two joined.
 */
export function apaParts(report: Report): { text: string; url: string } {
  const url = `${SITE_URL}${reportPath(report)}`;
  const author = apaAuthor(parseAuthor(report.author));
  return { text: `${author} ${apaDate(report)}. ${closeTitle(report.title)} R21 Labs.`, url };
}

export function apaLine(report: Report): string {
  const { text, url } = apaParts(report);
  return `${text} ${url}`;
}

export function bibtexEntry(report: Report): string {
  const { year, month } = parts(report.publishedOn);
  const url = `${SITE_URL}${reportPath(report)}`;
  const { family, given, organization } = parseAuthor(report.author);
  const author = given.length > 0 ? `${family}, ${given.join(" ")}` : family;
  return [
    `@misc{r21labs_${report.slug}_${report.lang},`,
    `  author = {${bibtexEscape(author)}},`,
    ...(organization ? [`  organization = {${bibtexEscape(organization)}},`] : []),
    `  title = {${bibtexEscape(report.title)}},`,
    `  year = {${year}},`,
    `  month = ${BIBTEX_MONTHS[month - 1]},`,
    `  publisher = {R21 Labs},`,
    `  url = {${url}}`,
    `}`,
  ].join("\n");
}
