import { adminPageMetadata } from "../_lib/metadata";
import Regional from "@/src/views/admin/Regional";

export const generateMetadata = adminPageMetadata("region");

export default function Page() {
  return <Regional />;
}
