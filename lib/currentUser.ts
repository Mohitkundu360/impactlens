import { db } from "./db";

/**
 * Full auth/RBAC is an explicit non-goal for this 9-day prototype. Every
 * request acts as a single seeded demo user. This function is the one place
 * that would change if real auth were added later — nothing else in the app
 * should special-case "no auth".
 */
export async function getCurrentUser() {
  const email = "demo@impactlens.local";

  let user = await db.user.findUnique({ where: { email } });
  if (!user) {
    user = await db.user.create({
      data: { email, name: "Demo User", role: "member" }
    });
  }
  return user;
}
