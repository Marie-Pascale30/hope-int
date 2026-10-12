import { fundraisingAdminMetadata } from "@/src/views/fundraising/admin/metadata";
import FundraiserModeration from "@/src/views/fundraising/admin/FundraiserModeration";

export const generateMetadata = fundraisingAdminMetadata("fundraisers");

export default function Page() {
  return <FundraiserModeration />;
}
