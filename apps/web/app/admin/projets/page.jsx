import { adminPageMetadata } from "../_lib/metadata";
import ContentManager from "@/src/views/admin/ContentManager";

export const generateMetadata = adminPageMetadata("projects");

export default function Page() {
  return <ContentManager type="projects" />;
}
