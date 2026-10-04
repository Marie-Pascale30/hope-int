"use client";

import { useEffect, useState } from "react";
import { DONATION_LIMITS, PROJECT_STATUSES, XAF_PER_EUR } from "@hope/shared/constants";
import { publicApi } from "../services";

// Referentiels (regions, roles proposables, moyens de paiement actifs...) charges une seule fois.
let cache = null;
let pending = null;

const FALLBACK = {
  regions: [],
  projectStatuses: PROJECT_STATUSES,
  interestAreas: [],
  providers: { stripe: false, mobileMoney: false, mobileMoneyProvider: null, notchpay: false, flutterwave: false },
  donationLimits: DONATION_LIMITS,
  xafPerEur: XAF_PER_EUR,
  organization: { name: "HOPE International", email: "", phone: "", address: "" },
};

export function useMeta() {
  const [meta, setMeta] = useState(cache);

  useEffect(() => {
    if (cache) return;
    pending = pending || publicApi.meta().then((result) => {
      cache = result;
      return result;
    }).catch(() => {
      pending = null;
      return null;
    });
    pending.then((result) => result && setMeta(result));
  }, []);

  return { meta: meta || FALLBACK, loaded: Boolean(meta) };
}

export const regionOptions = (meta) => (meta?.regions || []).map((region) => ({ value: region, label: region }));
