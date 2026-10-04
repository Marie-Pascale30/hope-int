import { adminPageMetadata } from "./_lib/metadata";
import Overview from "@/src/views/admin/Overview";

export const generateMetadata = adminPageMetadata("overview");

export default function Page() {
  return <Overview />;
}
