import { NextRequest } from "next/server";
import { getAdminAuth } from "@/lib/firebase-admin";
import { upsertUser } from "@/lib/database";

export async function requireUser(request: NextRequest) {
  const header = request.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;

  if (!token) {
    throw new Response("Unauthorized", { status: 401 });
  }

  const decoded = await getAdminAuth().verifyIdToken(token);
  const email = decoded.email ?? "";
  const name = decoded.name ?? null;

  return upsertUser({ firebaseUid: decoded.uid, email, name });
}
