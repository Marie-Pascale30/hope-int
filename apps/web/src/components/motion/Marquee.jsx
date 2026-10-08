// Bande qui defile en continu (inspire de "Infinite Moving Cards" et "Logo Marquee", 21st.dev).
// CSS uniquement (composant serveur) : la liste est dupliquee pour boucler sans saut ; la copie est
// masquee aux lecteurs d'ecran et sortie de la navigation clavier. Pause au survol et au focus ;
// animations reduites : simple bande a faire defiler a la main (voir .marquee dans globals.css).

// minItems : nombre d'elements minimal par moitie de bande, pour qu'elle reste pleine sur grand ecran.
export default function Marquee({ items, renderItem, getKey, minItems = 6, duration = 40, label, className = "" }) {
  if (!items?.length) return null;
  const repeat = Math.max(1, Math.ceil(minItems / items.length));
  const half = Array.from({ length: repeat }, (_, round) => items.map((item) => ({ item, round }))).flat();

  const renderHalf = (copy) =>
    half.map(({ item, round }) => (
      <li key={`${copy}-${round}-${getKey(item)}`} className="marquee__item">
        {renderItem(item)}
      </li>
    ));

  return (
    <div className={`marquee ${className}`.trim()} style={{ "--marquee-duration": `${duration}s` }}>
      <ul className="marquee__track" aria-label={label}>
        {renderHalf("a")}
      </ul>
      <ul className="marquee__track marquee__track--copy" aria-hidden="true" inert>
        {renderHalf("b")}
      </ul>
    </div>
  );
}
