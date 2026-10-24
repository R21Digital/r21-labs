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
export interface FooterStrings {
  newEntries: string;
  subscribeCopy: string;
  email: string;
  emailPlaceholder: string;
  subscribe: string;
  successTitle: string;
  successBody: string;
  navLabel: string;
  notes: string;
  suggest: string;
  work: string;
  terms: string;
}

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
  footer: FooterStrings;
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
    footer: {
      newEntries: "New entries",
      subscribeCopy:
        "A note when something is added or a playbook lands. No schedule, because there is no point sending one when nothing has been tested. Your address is used for that and nothing else.",
      email: "Email",
      emailPlaceholder: "you@company.com",
      subscribe: "Subscribe",
      successTitle: "Got your address.",
      successBody:
        "A person at R21 adds it by hand — there is no automated list yet, so this is not instant. You'll hear from us when there is something worth sending.",
      navLabel: "Site",
      notes: "Notes",
      suggest: "Suggest a tool",
      work: "Work with R21",
      terms: "Terms",
    },
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
    footer: {
      newEntries: "Entradas nuevas",
      subscribeCopy:
        "Una nota cuando se añada algo o salga un playbook. No hay calendario, porque no tiene sentido enviar uno cuando no se ha probado nada. Su correo se usa para eso y para nada más.",
      email: "Correo electrónico",
      emailPlaceholder: "usted@empresa.com",
      subscribe: "Suscribirse",
      successTitle: "Recibimos su correo.",
      successBody:
        "Una persona de R21 lo añade a mano; todavía no hay una lista automatizada, así que no es instantáneo. Sabrá de nosotros cuando haya algo que valga la pena enviar.",
      navLabel: "Sitio",
      notes: "Notas",
      suggest: "Sugerir una herramienta",
      work: "Trabaje con R21",
      terms: "Términos",
    },
  },
};
