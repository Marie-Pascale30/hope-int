import { adminPageMetadata } from "../_lib/metadata";
import ContentManager from "@/src/views/admin/ContentManager";

export const generateMetadata = adminPageMetadata("news");

export default function Page() {
  return <ContentManager type="news" />;
}
