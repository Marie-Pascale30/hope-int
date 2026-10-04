import { Fraunces, Inter } from "next/font/google";

// Polices auto-hebergees par next/font (telechargees au build), sous-ensembles latin + latin-ext.
// Les variables sont branchees sur les tokens --font-sans / --font-display (globals.css).
export const inter = Inter({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  variable: "--font-inter",
});

export const fraunces = Fraunces({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  variable: "--font-fraunces",
});

export const fontVariables = `${inter.variable} ${fraunces.variable}`;
