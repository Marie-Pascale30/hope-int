import { adminPageMetadata } from "../_lib/metadata";
import Members from "@/src/views/admin/Members";

export const generateMetadata = adminPageMetadata("members");

export default function Page() {
  return <Members />;
}
