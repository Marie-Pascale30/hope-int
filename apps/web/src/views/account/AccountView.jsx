"use client";

import "../../styles/account.css";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LayoutDashboard, LogOut, MapPin, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { Avatar, Badge, Button, Card, TabPanel, Tabs } from "../../components/ui";
import RequireAuth from "../../components/RequireAuth";
import { useAuth } from "../../context/AuthContext";
import { useLabels } from "../../utils/labels";
import { isStaff } from "../../utils/rbac";
import ChangePasswordForm from "./components/ChangePasswordForm";
import DonationsTab from "./components/DonationsTab";
import EventsTab from "./components/EventsTab";
import ProfileTab from "./components/ProfileTab";

// Valeurs des onglets (parametre ?onglet=, garde en francais pour les URL existantes).
const TAB_VALUES = ["dons", "evenements", "profil", "securite"];

function SecurityTab() {
  const t = useTranslations("account.space.security");
  return (
    <div className="acc-columns acc-tab">
      <Card>
        <h2 className="acc-section-title">{t("title")}</h2>
        <ChangePasswordForm />
      </Card>
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
          {tab === "evenements" && <EventsTab />}
          {tab === "profil" && <ProfileTab />}
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
