import { getTranslations, setRequestLocale } from "next-intl/server";
import { serverApi, settle } from "@/src/services/server";
import { transparencyServer } from "@/src/services/transparencyServer";
import TeamView from "@/src/views/transparency/TeamView";
import { buildMetadata } from "@/src/views/site/seo";

export const revalidate = 300;

export async function generateMetadata({ params }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "transparency.meta" });
  return buildMetadata({ locale, path: "/equipe", title: t("teamTitle"), description: t("teamDescription") });
}

export default async function TeamPage({ params }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [team, testimonials] = await Promise.all([
    settle(transparencyServer.team(locale)),
    settle(serverApi.listContent("testimonials", locale)),
  ]);
  return <TeamView members={team.data?.members} testimonials={testimonials.data} error={Boolean(team.error)} />;
}
