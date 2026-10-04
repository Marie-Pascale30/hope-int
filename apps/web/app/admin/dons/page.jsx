import { adminPageMetadata } from "../_lib/metadata";
import Donations from "@/src/views/admin/Donations";

export const generateMetadata = adminPageMetadata("donations");

export default function Page() {
  return <Donations />;
}
