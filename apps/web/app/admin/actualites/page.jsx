import ContentManager from "@/src/views/admin/ContentManager";

export const metadata = { title: "Actualités" };

export default function Page() {
  return <ContentManager type="news" />;
}
