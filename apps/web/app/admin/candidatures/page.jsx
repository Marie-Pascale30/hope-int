import { adminPageMetadata } from "../_lib/metadata";
import Applications from "@/src/views/admin/Applications";

export const generateMetadata = adminPageMetadata("applications");

export default function Page() {
  return <Applications />;
}
