// Layout racine neutre : chaque espace ([locale] pour le site, admin) fournit son propre <html>.
// Sa presence permet a notFound() d'afficher la 404 dans le layout traduit de la langue.
export default function RootLayout({ children }) {
  return children;
}
