import { adminPageMetadata } from "../_lib/metadata";
import Finance from "@/src/views/admin/Finance";

export const generateMetadata = adminPageMetadata("finance");

export default function Page() {
  return <Finance />;
}
