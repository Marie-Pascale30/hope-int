import { adminPageMetadata } from "../_lib/metadata";
import Messages from "@/src/views/admin/Messages";

export const generateMetadata = adminPageMetadata("messages");

export default function Page() {
  return <Messages />;
}
