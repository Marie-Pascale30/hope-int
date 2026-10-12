// Aides de test i18n : messages francais (langue de reference) charges de facon synchrone,
// traducteur hors React et rendu enveloppe dans NextIntlClientProvider.
import { render } from "@testing-library/react";
import { createTranslator, NextIntlClientProvider } from "next-intl";
import account from "@/src/i18n/messages/fr/account.json";
import admin from "@/src/i18n/messages/fr/admin.json";
import adminOps from "@/src/i18n/messages/fr/adminOps.json";
import common from "@/src/i18n/messages/fr/common.json";
import site from "@/src/i18n/messages/fr/site.json";
import { TIME_ZONE } from "@/src/i18n/config";

export const frMessages = { ...common, ...site, ...account, ...admin, ...adminOps };

/** Traducteur (equivalent de useTranslations(namespace)) sur les messages francais. */
export function translator(namespace, { locale = "fr", messages = frMessages } = {}) {
  return createTranslator({ locale, messages, namespace, timeZone: TIME_ZONE });
}

/** Lit une cle "a.b.c" dans les messages (pour comparer sans recopier les textes). */
export function message(key, messages = frMessages) {
  return key.split(".").reduce((node, part) => node?.[part], messages);
}

/** render() de Testing Library avec le fournisseur next-intl. */
export function renderWithIntl(ui, { locale = "fr", messages = frMessages, ...options } = {}) {
  const Wrapper = ({ children }) => (
    <NextIntlClientProvider locale={locale} messages={messages} timeZone={TIME_ZONE}>
      {children}
    </NextIntlClientProvider>
  );
  return render(ui, { wrapper: Wrapper, ...options });
}
