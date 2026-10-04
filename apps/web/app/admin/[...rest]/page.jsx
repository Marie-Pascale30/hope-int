import { notFound } from "next/navigation";

// Adresse inconnue sous /admin : 404 dans l'habillage du back-office.
export default function AdminUnknownPage() {
  notFound();
}
