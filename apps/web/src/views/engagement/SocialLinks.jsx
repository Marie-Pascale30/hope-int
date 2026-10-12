// Liens vers les reseaux sociaux (composant serveur ou client, sans etat).
import { Facebook, Instagram, Linkedin, MessageCircle, Music2, Twitter, Youtube } from "lucide-react";
import { useTranslations } from "next-intl";
import { socialLinks } from "./socialNetworks";

const ICONS = { facebook: Facebook, instagram: Instagram, linkedin: Linkedin, x: Twitter, youtube: Youtube, tiktok: Music2, whatsapp: MessageCircle };

export default function SocialLinks({ links = socialLinks() }) {
  const t = useTranslations("engagement.footer");
  if (!links.length) return null;
  return (
    <div className="eng-social">
      <h2 className="site-footer__title">{t("socialTitle")}</h2>
      <ul className="eng-social__list">
        {links.map(({ id, name, url }) => {
          const Icon = ICONS[id] || MessageCircle;
          return (
            <li key={id}>
              <a href={url} target="_blank" rel="noopener noreferrer" aria-label={t("socialLabel", { network: name })} title={name}>
                <Icon size={18} aria-hidden="true" />
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
