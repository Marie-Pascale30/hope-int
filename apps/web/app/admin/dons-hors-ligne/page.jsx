import { fundraisingAdminMetadata } from "@/src/views/fundraising/admin/metadata";
import OfflineDonations from "@/src/views/fundraising/admin/OfflineDonations";

export const generateMetadata = fundraisingAdminMetadata("offline");

export default function Page() {
  return <OfflineDonations />;
}
