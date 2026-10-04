import { adminPageMetadata } from "../_lib/metadata";
import Events from "@/src/views/admin/Events";

export const generateMetadata = adminPageMetadata("events");

export default function Page() {
  return <Events />;
}
