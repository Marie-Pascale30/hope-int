"use client";

import "../../styles/account.css";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LayoutDashboard, LogOut, MapPin, ShieldCheck } from "lucide-react";
import { Avatar, Badge, Button, Card, Tabs } from "../../components/ui";
import RequireAuth from "../../components/RequireAuth";
import { useAuth } from "../../context/AuthContext";
import { roleLabel } from "../../utils/labels";
import { isStaff } from "../../utils/rbac";
import ChangePasswordForm from "./components/ChangePasswordForm";
import DonationsTab from "./components/DonationsTab";
import EventsTab from "./components/EventsTab";
import ProfileTab from "./components/ProfileTab";

const TABS = [
  { value: "dons", label: "Mes dons" },
  { value: "evenements", label: "Mes événements" },
  { value: "profil", label: "Mon profil" },
  { value: "securite", label: "Sécurité" },
];

function SecurityTab() {
  return (
    <div className="acc-columns acc-tab">
      <Card>
        <h2 className="acc-section-title">Changer mon mot de passe</h2>
        <ChangePasswordForm />
      </Card>
      <Card className="acc-security-tips">
        <span className="acc-sub__icon"><ShieldCheck aria-hidden="true" /></span>
        <h2 className="acc-section-title">Bonnes pratiques</h2>
        <ul>
          <li>Choisissez un mot de passe unique, d’au moins 12 caractères idéalement.</li>
          <li>Après un changement, vos autres sessions sont automatiquement déconnectées.</li>
          <li>HOPE International ne vous demandera jamais votre mot de passe par email ou par téléphone.</li>
        </ul>
      </Card>
    </div>
  );
}

function AccountContent() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const requested = params.get("onglet");
  const tab = TABS.some((item) => item.value === requested) ? requested : "dons";
  const firstName = user.name.split(" ")[0];

  const changeTab = (value) => router.replace(`${pathname}?onglet=${value}`, { scroll: false });

  return (
    <>
      <section className="acc-hero">
        <div className="container acc-hero__inner">
          <Avatar name={user.name} large />
          <div className="acc-hero__text">
            <span className="eyebrow">Mon espace</span>
            <h1>Bonjour, {firstName}</h1>
            <p className="acc-hero__meta">
              {user.region && (
                <span><MapPin size={15} aria-hidden="true" /> {user.region}</span>
              )}
              {(user.roles || [user.role]).map((role) => (
                <Badge key={role} tone="brand">{roleLabel(role)}</Badge>
              ))}
            </p>
          </div>
          <div className="acc-hero__actions">
            {isStaff(user) && (
              <Button href="/admin" icon={LayoutDashboard}>Accéder à l’administration</Button>
            )}
            <Button variant="ghost" icon={LogOut} onClick={logout}>Se déconnecter</Button>
          </div>
        </div>
      </section>
      <div className="container acc-body">
        <Tabs tabs={TABS} value={tab} onChange={changeTab} label="Rubriques de mon espace" />
        <div role="tabpanel" aria-label={TABS.find((item) => item.value === tab).label}>
          {tab === "dons" && <DonationsTab />}
          {tab === "evenements" && <EventsTab />}
          {tab === "profil" && <ProfileTab />}
          {tab === "securite" && <SecurityTab />}
        </div>
      </div>
    </>
  );
}

export default function AccountView() {
  return (
    <RequireAuth>
      <AccountContent />
    </RequireAuth>
  );
}
