"use client";

import "../../styles/account.css";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Clock, Download, FolderHeart, Heart, RotateCcw, Share2, UserPlus, Wallet, XCircle } from "lucide-react";
import { Button, Card, ErrorState, LoadingState } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import { useAsync } from "../../hooks/useAsync";
import { paymentApi } from "../../services";
import { getErrorMessage } from "../../services/api";
import { toast } from "../../utils/alerts";
import { formatDateTime, formatMoney } from "../../utils/format";
import { FREQUENCY, PAYMENT_METHOD } from "../../utils/labels";

const REF_PATTERN = /^[a-f0-9]{48}$/i;

function ReceiptDetails({ payment }) {
  return (
    <dl className="dl don-thanks__dl">
      <dt>Montant</dt>
      <dd>
        {formatMoney(payment.amount, payment.currency)}
        {payment.frequency === "monthly" && " par mois"}
      </dd>
      <dt>Affectation</dt>
      <dd>{payment.project_title || "Là où c’est le plus utile"}</dd>
      <dt>Moyen</dt>
      <dd>
        {PAYMENT_METHOD[payment.method] || payment.method} · {FREQUENCY[payment.frequency] || payment.frequency}
      </dd>
      {payment.paid_at && (
        <>
          <dt>Date</dt>
          <dd>{formatDateTime(payment.paid_at)}</dd>
        </>
      )}
      {payment.receipt_number && (
        <>
          <dt>N° de reçu</dt>
          <dd><strong>{payment.receipt_number}</strong></dd>
        </>
      )}
    </dl>
  );
}

async function share() {
  const url = `${window.location.origin}/don`;
  const text = "Je viens de soutenir HOPE International, qui accompagne les familles camerounaises vers l’autonomie. Rejoignez-moi !";
  try {
    if (navigator.share) {
      await navigator.share({ title: "HOPE International", text, url });
    } else {
      await navigator.clipboard.writeText(`${text} ${url}`);
      toast("Lien copié : il ne reste plus qu’à le partager");
    }
  } catch {
    // Partage annule par l'utilisateur : rien a signaler.
  }
}

function Success({ payment, isAuthenticated }) {
  const firstName = (payment.donor_name || "").split(" ")[0];
  return (
    <>
      <div className="don-thanks__head">
        <span className="don-thanks__icon don-thanks__icon--success"><CheckCircle2 size={36} aria-hidden="true" /></span>
        <span className="eyebrow">Don confirmé</span>
        <h1>Merci{firstName ? `, ${firstName}` : ""} !</h1>
        <p className="lead">
          Votre don de <strong>{formatMoney(payment.amount, payment.currency)}</strong>
          {payment.frequency === "monthly" && " par mois"} va directement aider des familles à construire leur avenir.
          Toute l’équipe de HOPE International vous remercie chaleureusement.
        </p>
      </div>
      <Card className="don-thanks__card">
        <ReceiptDetails payment={payment} />
        <div className="don-thanks__actions">
          <Button
            href={paymentApi.receiptPdfUrl(payment.receipt_token)}
            target="_blank"
            rel="noopener noreferrer"
            icon={Download}
          >
            Télécharger mon reçu (PDF)
          </Button>
        </div>
        <p className="muted don-thanks__note">
          Un reçu vous a également été envoyé par email.
          {payment.frequency === "monthly" && " Vous pouvez arrêter votre don mensuel à tout moment depuis votre espace."}
        </p>
      </Card>
      <div className="don-thanks__next">
        <Card hover className="don-next">
          <FolderHeart aria-hidden="true" />
          <h2>Découvrir nos projets</h2>
          <p className="muted">Microcrédit, formation, coopératives : suivez les actions que vous rendez possibles.</p>
          <Button href="/projets" variant="secondary" size="sm">Voir les projets</Button>
        </Card>
        <Card hover className="don-next">
          <Share2 aria-hidden="true" />
          <h2>Faire connaître HOPE</h2>
          <p className="muted">Un partage peut inspirer un proche à rejoindre le mouvement.</p>
          <Button variant="secondary" size="sm" onClick={share}>Partager</Button>
        </Card>
        {isAuthenticated ? (
          <Card hover className="don-next">
            <Wallet aria-hidden="true" />
            <h2>Mes dons</h2>
            <p className="muted">Retrouvez l’historique de vos dons et tous vos reçus.</p>
            <Button href="/espace" variant="secondary" size="sm">Mon espace</Button>
          </Card>
        ) : (
          <Card hover className="don-next">
            <UserPlus aria-hidden="true" />
            <h2>Créer un compte</h2>
            <p className="muted">Pour suivre vos prochains dons et retrouver vos reçus en un clic.</p>
            <Button href="/inscription" variant="secondary" size="sm">Créer mon compte</Button>
          </Card>
        )}
      </div>
    </>
  );
}

function Pending({ payment, onCheck, checking }) {
  return (
    <>
      <div className="don-thanks__head">
        <span className="don-thanks__icon don-thanks__icon--pending"><Clock size={36} aria-hidden="true" /></span>
        <span className="eyebrow">Confirmation en cours</span>
        <h1>Votre paiement est en cours de validation</h1>
        <p className="lead">
          Selon le moyen de paiement, notamment Mobile Money, la confirmation peut prendre quelques minutes. Dès qu’elle
          nous parvient, votre reçu vous est envoyé par email.
        </p>
      </div>
      <Card className="don-thanks__card">
        <ReceiptDetails payment={payment} />
        <div className="don-thanks__actions">
          <Button icon={RotateCcw} loading={checking} onClick={onCheck}>Vérifier à nouveau</Button>
          <Button href="/" variant="ghost">Retour à l’accueil</Button>
        </div>
      </Card>
    </>
  );
}

function Failed({ payment }) {
  const canceled = payment.status === "canceled";
  const refunded = payment.status === "refunded";
  const retry = payment.project_id ? `/don?projet=${payment.project_id}` : "/don";
  return (
    <>
      <div className="don-thanks__head">
        <span className="don-thanks__icon don-thanks__icon--failed"><XCircle size={36} aria-hidden="true" /></span>
        <span className="eyebrow">{refunded ? "Don remboursé" : canceled ? "Paiement annulé" : "Paiement refusé"}</span>
        <h1>{refunded ? "Ce don a été remboursé" : "Le paiement n’a pas abouti"}</h1>
        <p className="lead">
          {refunded
            ? "Le montant de ce don vous a été restitué. Pour toute question, n’hésitez pas à nous contacter."
            : canceled
              ? "Le paiement a été annulé avant sa validation : aucun montant n’a été encaissé."
              : "Votre banque ou votre opérateur a refusé le paiement : aucun montant n’a été encaissé. Vous pouvez réessayer, éventuellement avec un autre moyen de paiement."}
        </p>
      </div>
      <Card className="don-thanks__card">
        <ReceiptDetails payment={payment} />
        <div className="don-thanks__actions">
          {!refunded && <Button href={retry} variant="accent" icon={Heart}>Réessayer</Button>}
          <Button href="/contact" variant="ghost">Nous contacter</Button>
        </div>
      </Card>
    </>
  );
}

export default function DonationThanksView() {
  const params = useSearchParams();
  const { isAuthenticated } = useAuth();
  const ref = params.get("ref") || "";
  const transactionId = params.get("transaction_id") || undefined;
  const redirectStatus = params.get("status") || undefined;
  const valid = REF_PATTERN.test(ref);

  const { data: payment, loading, error, reload } = useAsync(
    () => paymentApi.confirmReceipt(ref, { transactionId, status: redirectStatus }),
    [ref],
    { enabled: valid }
  );

  let content;
  if (!valid) {
    content = (
      <ErrorState
        title="Référence de don manquante"
        message="Ce lien ne contient pas de référence de don valide. Si vous venez d’effectuer un paiement, consultez l’email de confirmation ou votre espace donateur."
      />
    );
  } else if (!payment && loading) {
    content = <LoadingState label="Vérification de votre paiement…" />;
  } else if (!payment) {
    const notFound = error?.response?.status === 404;
    content = (
      <ErrorState
        title={notFound ? "Don introuvable" : "Vérification impossible"}
        message={notFound ? "Aucun don ne correspond à cette référence." : getErrorMessage(error)}
        onRetry={notFound ? undefined : reload}
      />
    );
  } else if (payment.status === "succeeded") {
    content = <Success payment={payment} isAuthenticated={isAuthenticated} />;
  } else if (payment.status === "pending") {
    content = <Pending payment={payment} onCheck={reload} checking={loading} />;
  } else {
    content = <Failed payment={payment} />;
  }

  return (
    <section className="section--tight don-thanks">
      <div className="container don-thanks__inner">
        {content}
        {(!valid || (!payment && !loading)) && (
          <div className="don-thanks__actions don-thanks__actions--center">
            <Button href="/don" variant="accent" icon={Heart}>Faire un don</Button>
            <Button href="/espace" variant="ghost">Mon espace</Button>
          </div>
        )}
      </div>
    </section>
  );
}
