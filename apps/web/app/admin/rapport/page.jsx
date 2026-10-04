import { adminPageMetadata } from "../_lib/metadata";
import AnnualReport from "@/src/views/admin/AnnualReport";

export const generateMetadata = adminPageMetadata("report");

export default function Page() {
  return <AnnualReport />;
}
