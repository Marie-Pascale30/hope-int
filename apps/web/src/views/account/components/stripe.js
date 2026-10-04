import { loadStripe } from "@stripe/stripe-js";

export const STRIPE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "";

// Stripe.js n'est charge qu'une fois par langue, et seulement si le paiement par carte est actif.
// La langue regle les messages d'erreur renvoyes par Stripe (confirmCardPayment).
const stripePromises = new Map();

export function getStripe(locale = "fr") {
  if (!stripePromises.has(locale)) stripePromises.set(locale, loadStripe(STRIPE_PUBLISHABLE_KEY, { locale }));
  return stripePromises.get(locale);
}
