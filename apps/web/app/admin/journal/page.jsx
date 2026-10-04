import { adminPageMetadata } from "../_lib/metadata";
import Logs from "@/src/views/admin/Logs";

export const generateMetadata = adminPageMetadata("logs");

export default function Page() {
  return <Logs />;
}
