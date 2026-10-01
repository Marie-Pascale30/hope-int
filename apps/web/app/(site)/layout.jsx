import SiteHeader from "@/src/components/site/SiteHeader";
import SiteFooter from "@/src/components/site/SiteFooter";

export default function SiteLayout({ children }) {
  return (
    <div className="site-shell">
      <a href="#contenu" className="visually-hidden">Aller au contenu</a>
      <SiteHeader />
      <main id="contenu" className="site-main">{children}</main>
      <SiteFooter />
    </div>
  );
}
