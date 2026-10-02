import localFont from "next/font/local";
import { cn } from "@/lib/tailwind-utils";

/**
 * Bitcount Prop Single (Google Fonts, SIL OFL), latin subset, self-hosted so its vertical
 * metrics can be corrected — `next/font/google` can't override them.
 *
 * Stock metrics are ascent 0.84em / descent 0.36em, but caps and ascenders only reach ~0.6–0.7em,
 * so glyphs sat 1–2px above centre in buttons and inputs. These overrides keep the same 1.2em
 * line box and centre the cap/ascender band instead. If you switch fonts, re-measure (or drop
 * the declarations): the right values are font-specific.
 */
const regularMonoFont = localFont({
  src: "../fonts/bitcount-prop-single-latin.woff2",
  weight: "400",
  variable: "--font-regular-mono",
  display: "swap",
  declarations: [
    { prop: "ascent-override", value: "93%" },
    { prop: "descent-override", value: "27%" },
    { prop: "line-gap-override", value: "0%" },
  ],
});

export default cn(regularMonoFont.variable);
