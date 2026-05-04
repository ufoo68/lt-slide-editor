import { NextRequest } from "next/server";
import { getAdminAuth } from "@/lib/firebase-admin";
import { prisma } from "@/lib/prisma";

export async function requireUser(request: NextRequest) {
  const header = request.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;

  if (!token) {
    throw new Response("Unauthorized", { status: 401 });
  }

  const decoded = await getAdminAuth().verifyIdToken(token);
  const email = decoded.email ?? "";
  const name = decoded.name ?? null;

  return prisma.user.upsert({
    where: { firebaseUid: decoded.uid },
    update: { email, name },
    create: {
      firebaseUid: decoded.uid,
      email,
      name,
    },
  });
}
