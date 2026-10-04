import { adminPageMetadata } from "../_lib/metadata";
import Roles from "@/src/views/admin/Roles";

export const generateMetadata = adminPageMetadata("roles");

export default function Page() {
  return <Roles />;
}
