"use client";

import "../../styles/account.css";
import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LayoutDashboard, LogOut, MapPin, MonitorSmartphone, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { Avatar, Badge, Button, Card, TabPanel, Tabs } from "../../components/ui";
import RequireAuth from "../../components/RequireAuth";
import { useAuth } from "../../context/AuthContext";
import { useAlerts } from "../../utils/alerts";
import { useErrorMessage } from "../../i18n/errors";
import { useLabels } from "../../utils/labels";
import { isStaff } from "../../utils/rbac";
import ChangePasswordForm from "./components/ChangePasswordForm";
import PageBanner from "../../components/site/PageBanner";
import DonationsTab from "./components/DonationsTab";
import EventsTab from "./components/EventsTab";
import ProfileTab from "./components/ProfileTab";
import FundraisersPanel from "./components/FundraisersPanel";
import PledgesPanel from "./components/PledgesPanel";
import SupportedProjectsTab from "../engagement/SupportedProjectsTab";
import MyVolunteeringTab from "../volunteering/MyVolunteeringTab";
import { MyPublicProfile } from "../transparency/admin/TeamProfileForm";

// Valeurs des onglets (parametre ?onglet=, garde en francais pour les URL existantes).
const TAB_VALUES = ["dons", "engagements", "projets", "collectes", "evenements", "benevolat", "profil", "securite"];

// Deconnexion de tous les appareils (POST /auth/logout-all) : revoque aussi la session courante.
function SessionsCard() {
  const t = useTranslations("account.space.security.sessions");
  const { logout } = useAuth();
  const { confirmAction, showError } = useAlerts();
  const errorText = useErrorMessage();
  const [busy, setBusy] = useState(false);

  const logoutAll = async () => {
    const ok = await confirmAction(t("confirmTitle"), t("confirmText"), t("confirm"), { danger: true });
    if (!ok) return;
    setBusy(true);
    try {
      await logout({ allDevices: true });
    } catch (err) {
      setBusy(false);
      showError(t("failed"), errorText(err));
    }
  };

  return (
    <Card>
      <h2 className="acc-section-title">{t("title")}</h2>
      <p className="muted">{t("text")}</p>
      <Button variant="secondary" icon={MonitorSmartphone} loading={busy} onClick={logoutAll}>
        {t("button")}
      </Button>
    </Card>
  );
}

function SecurityTab() {
  const t = useTranslations("account.space.security");
  return (
    <div className="acc-columns acc-tab">
      <div className="stack">
        <Card>
          <h2 className="acc-section-title">{t("title")}</h2>
          <ChangePasswordForm />
        </Card>
        <SessionsCard />
      </div>
      <Card className="acc-security-tips">
        <span className="acc-sub__icon"><ShieldCheck aria-hidden="true" /></span>
        <h2 className="acc-section-title">{t("tipsTitle")}</h2>
        <ul>
          <li>{t("tip1")}</li>
          <li>{t("tip2")}</li>
          <li>{t("tip3")}</li>
        </ul>
      </Card>
    </div>
  );
}

function AccountContent() {
  const t = useTranslations("account.space");
  const labels = useLabels();
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const requested = params.get("onglet");
  const tab = TAB_VALUES.includes(requested) ? requested : "dons";
  const firstName = user.name.split(" ")[0];
  const tabs = TAB_VALUES.map((value) => ({ value, label: t(`tabs.${value}`) }));

  const changeTab = (value) => router.replace(`${pathname}?onglet=${value}`, { scroll: false });

  return (
    <>
      <PageBanner name="account" />
      <section className="acc-hero">
        <div className="container acc-hero__inner">
          <Avatar name={user.name} large />
          <div className="acc-hero__text">
            <span className="eyebrow">{t("eyebrow")}</span>
            <h1>{t("hello", { name: firstName })}</h1>
            <p className="acc-hero__meta">
              {user.region && (
                <span><MapPin size={15} aria-hidden="true" /> {user.region}</span>
              )}
              {(user.roles || [user.role]).map((role) => (
                <Badge key={role} tone="brand">{labels.role(role)}</Badge>
              ))}
            </p>
          </div>
          <div className="acc-hero__actions">
            {isStaff(user) && (
              <Button href="/admin" icon={LayoutDashboard}>{t("admin")}</Button>
            )}
            <Button variant="ghost" icon={LogOut} onClick={logout}>{t("logout")}</Button>
          </div>
        </div>
      </section>
      <div className="container acc-body">
        <Tabs id="account-tabs" tabs={tabs} value={tab} onChange={changeTab} label={t("tabsLabel")} />
        <TabPanel tabsId="account-tabs" value={tab}>
          {tab === "dons" && <DonationsTab />}
          {tab === "engagements" && <PledgesPanel />}
          {tab === "projets" && <SupportedProjectsTab />}
          {tab === "collectes" && <FundraisersPanel />}
          {tab === "evenements" && <EventsTab />}
          {tab === "benevolat" && <MyVolunteeringTab />}
          {tab === "profil" && (
            <>
              <ProfileTab />
              {/* Portrait public (page Equipe) : reserve aux membres de l'equipe. */}
              {isStaff(user) && <MyPublicProfile />}
            </>
          )}
          {tab === "securite" && <SecurityTab />}
        </TabPanel>
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
