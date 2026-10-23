import type { Lang } from "./research";

/**
 * Chrome strings for the research surface, in the two languages it ships in.
 *
 * Two keys, on purpose. The rest of the site is English only, and this table is
 * the door to full localization rather than a commitment to it: if that ever
 * happens it gets replaced by a real i18n layer, which is fine.
 *
 * `readIn` is the label of the link that goes to the OTHER language, so it
 * lives in the language of the page that shows it: English pages say
 * "Leer en español", Spanish pages say "Read in English".
 */
export interface Strings {
  research: string;
  allReports: string;
  measuredOn: string;
  sample: string;
  citeThis: string;
  download: string;
  pdf: string;
  readIn: string;
  issue: string;
  published: string;
  indexTitle: string;
  indexIntro: string;
  empty: string;
  bibtex: string;
  by: string;
  home: string;
}

export const STRINGS: Record<Lang, Strings> = {
  en: {
    research: "Research",
    allReports: "All reports",
    measuredOn: "Measured on",
    sample: "Sample",
    citeThis: "Cite this",
    download: "Download",
    pdf: "PDF",
    readIn: "Leer en español",
    issue: "Issue",
    published: "Published",
    indexTitle: "Measured, then written down",
    indexIntro:
      "Reports from R21 Labs. Each one names how it was measured, ships the data behind its numbers, and can be cited.",
    empty: "No reports published yet. The first one is in preparation.",
    bibtex: "BibTeX",
    by: "By",
    home: "R21 Labs",
  },
  es: {
    research: "Investigación",
    allReports: "Todos los informes",
    measuredOn: "Medido el",
    sample: "Muestra",
    citeThis: "Cómo citar",
    download: "Descargar",
    pdf: "PDF",
    readIn: "Read in English",
    issue: "Edición",
    published: "Publicado",
    indexTitle: "Primero se mide, después se escribe",
    indexIntro:
      "Informes de R21 Labs. Cada uno explica cómo se midió, incluye los datos detrás de sus números y se puede citar.",
    empty: "Todavía no hay informes publicados. El primero está en preparación.",
    bibtex: "BibTeX",
    by: "Por",
    home: "R21 Labs",
  },
};
