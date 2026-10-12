import { fundraisingAdminMetadata } from "@/src/views/fundraising/admin/metadata";
import PledgesAdmin from "@/src/views/fundraising/admin/PledgesAdmin";

export const generateMetadata = fundraisingAdminMetadata("pledges");

export default function Page() {
  return <PledgesAdmin />;
}
