import { reportPath, type Report } from "./research";
import { SITE_URL } from "./site";

/**
 * Citation text for a report: an APA line and a BibTeX entry. Pure functions,
 * kept out of the component so they can be unit tested without rendering.
 */

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
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

export function apaLine(report: Report): string {
  const { year, month, day } = parts(report.publishedOn);
  const url = `${SITE_URL}${reportPath(report)}`;
  return `${report.author} (${year}, ${MONTHS[month - 1]} ${day}). ${report.title}. R21 Labs. ${url}`;
}

export function bibtexEntry(report: Report): string {
  const { year, month } = parts(report.publishedOn);
  const url = `${SITE_URL}${reportPath(report)}`;
  return [
    `@misc{r21labs_${report.slug}_${report.lang},`,
    `  author = {${bibtexEscape(report.author)}},`,
    `  title = {${bibtexEscape(report.title)}},`,
    `  year = {${year}},`,
    `  month = ${BIBTEX_MONTHS[month - 1]},`,
    `  publisher = {R21 Labs},`,
    `  url = {${url}}`,
    `}`,
  ].join("\n");
}
