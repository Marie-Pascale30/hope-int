"use client";

// Memorise la source d'arrivee (?ref=) sur n'importe quelle page publique (fiche projet, actualite...)
// pour l'attribuer au don si le visiteur donne ensuite (lue par /don). A monter une fois dans le
// layout du site public ; ne rend rien.
import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { cleanSource } from "@hope/shared/fundraising";
import { rememberSource } from "../donateParams";

export default function SourceTracker() {
  const params = useSearchParams();
  const ref = params.get("ref");
  useEffect(() => {
    // /don/merci?ref=<jeton du recu> : un jeton n'est jamais une source.
    if (!ref || /^[a-f0-9]{48}$/i.test(ref)) return;
    const source = cleanSource(ref);
    if (source) rememberSource(source);
  }, [ref]);
  return null;
}
