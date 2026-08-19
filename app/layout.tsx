import type { Metadata } from "next";
import { Montserrat, Open_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

/* Type families are brand-locked (brand-r21 "Midnight AI"):
   Montserrat for headings, Open Sans for body, JetBrains Mono for eyebrows,
   labels and technical metadata — the mono is the brand's "AI/tech" register,
   which is also where the direction wants its utility labelling. */

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["600", "700", "900"],
  display: "swap",
});

const openSans = Open_Sans({
  variable: "--font-open-sans",
  subsets: ["latin"],
  weight: ["400", "600"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "R21 Labs",
  description:
    "The AI tools R21 tested and recommends, the software R21 built, and the playbooks that connect them.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${montserrat.variable} ${openSans.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
