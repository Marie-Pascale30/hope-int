// Variante "pure" : le script Stripe n'est injecte qu'a l'appel de loadStripe (pas a l'import).
import { loadStripe } from "@stripe/stripe-js/pure";

export const STRIPE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "";

// Stripe.js n'est charge qu'une fois par langue, et seulement quand le paiement par carte est choisi.
// La langue regle les messages d'erreur renvoyes par Stripe (confirmCardPayment).
const stripePromises = new Map();

export function getStripe(locale = "fr") {
  if (!stripePromises.has(locale)) stripePromises.set(locale, loadStripe(STRIPE_PUBLISHABLE_KEY, { locale }));
  return stripePromises.get(locale);
}
