"use client";

import "../../styles/public.css";
import { Newspaper } from "lucide-react";
import { Button, EmptyState, ErrorState } from "../../components/ui";
import { useAsync } from "../../hooks/useAsync";
import { publicApi } from "../../services";
import { getErrorMessage } from "../../services/api";
import { CardsSkeleton, NewsCard, PublicHero } from "./components";

const byDateDesc = (a, b) => new Date(b.created_at) - new Date(a.created_at);

export default function NewsView() {
  const { data, loading, error, reload } = useAsync(() => publicApi.listContent("news"), []);
  const [featured, ...others] = [...(data || [])].sort(byDateDesc);

  return (
    <>
      <PublicHero
        eyebrow="Actualités"
        title="Nouvelles du terrain"
        lead="Lancements de projets, retours d’expérience, vie de l’association : suivez ce que vos dons et votre engagement rendent possible."
      />
      <section className="section section--tight">
        <div className="container">
          {loading ? (
            <CardsSkeleton count={3} />
          ) : error ? (
            <ErrorState message={getErrorMessage(error)} onRetry={reload} />
          ) : !featured ? (
            <EmptyState
              icon={Newspaper}
              title="Aucune actualité pour le moment"
              description="Nos équipes publieront bientôt des nouvelles des projets. En attendant, découvrez nos actions en cours."
              action={<Button href="/projets">Voir nos projets</Button>}
            />
          ) : (
            <div className="stack" style={{ gap: "clamp(20px, 3vw, 32px)" }}>
              <NewsCard item={featured} featured />
              {others.length > 0 && (
                <div className={others.length === 2 ? "grid grid--2" : "grid grid--3"}>
                  {others.map((item) => <NewsCard key={item.id} item={item} />)}
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
