import { currentUser, isConfigured, json } from "../../../lib/server/guard.js";

// Tells the page whether the server is set up and who is signed in
export async function GET() {
  if (!isConfigured()) return json({ configured: false });
  const email = await currentUser();
  return email ? json({ configured: true, email }) : json({ configured: true }, 401);
}
