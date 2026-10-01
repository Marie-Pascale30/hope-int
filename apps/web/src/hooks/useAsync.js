"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

// Charge des donnees asynchrones. `fetcher` renvoie directement les donnees (voir services/index.js).
// Renvoie { data, loading, error, reload, setData }.
export function useAsync(fetcher, deps = [], { enabled = true } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState(null);
  const fetcherRef = useRef(fetcher);
  // Toujours la derniere version du fetcher, sans relancer le chargement a chaque rendu.
  useLayoutEffect(() => {
    fetcherRef.current = fetcher;
  });

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetcherRef.current();
      setData(result);
      return result;
    } catch (err) {
      setError(err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (enabled) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);

  return { data, loading, error, reload, setData };
}
