"use client";

// Badge "Vous etes inscrit(e)" : les pages publiques sont rendues sans session (cache partage),
// l'inscription du visiteur connecte est donc relue cote client (GET /events/mine, une fois).
import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "../../../components/ui";
import { useAuth } from "../../../context/AuthContext";
import { publicApi } from "../../../services";

const store = { userId: null, promise: null };

function loadMyEventIds(userId) {
  if (store.userId !== userId || !store.promise) {
    store.userId = userId;
    store.promise = publicApi
      .myEvents()
      .then((events) => new Set((events || []).map((event) => Number(event.id))))
      .catch(() => {
        store.promise = null;
        return new Set();
      });
  }
  return store.promise;
}

// A appeler apres une inscription / desinscription.
export function invalidateMyEvents() {
  store.promise = null;
}

export function useMyEventIds() {
  const { status, user } = useAuth();
  const userId = status === "authenticated" ? user?.id : null;
  const [state, setState] = useState({ userId: null, ids: null });

  useEffect(() => {
    if (!userId) return undefined;
    let active = true;
    loadMyEventIds(userId).then((ids) => active && setState({ userId, ids }));
    return () => {
      active = false;
    };
  }, [userId]);

  return userId && state.userId === userId ? state.ids : null;
}

export default function RegisteredBadge({ eventId, plain }) {
  const t = useTranslations("site.cards");
  const ids = useMyEventIds();
  if (!ids?.has(Number(eventId))) return null;
  return (
    <Badge tone="success" plain={plain}>
      {plain && <CheckCircle2 size={14} aria-hidden="true" />} {t("registered")}
    </Badge>
  );
}
