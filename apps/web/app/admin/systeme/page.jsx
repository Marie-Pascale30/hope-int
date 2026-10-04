import { adminPageMetadata } from "../_lib/metadata";
import System from "@/src/views/admin/System";

export const generateMetadata = adminPageMetadata("system");

export default function Page() {
  return <System />;
}
