import { getProfile } from "@/lib/server/content";
import { json } from "@/lib/server/http";
export async function GET() { try { return json({ profile: await getProfile() }); } catch { return json({ error: "Unable to load profile" }, 500); } }
