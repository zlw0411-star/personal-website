import { DEFAULT_PROFILE } from "@/lib/content-types";
import { getProfile, listPublicEntries } from "@/lib/server/content";
import { CategoryPage } from "@/components/public/CategoryPage";

export const dynamic = "force-dynamic";

export default async function ExperiencePage() {
  const [profile, entries] = await Promise.all([getProfile(), listPublicEntries("learning")]);
  return <CategoryPage category="learning" entries={entries} profile={profile ?? DEFAULT_PROFILE} />;
}
