import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await auth.$context;
  const count = await ctx.adapter.count({ model: "user" });
  return Response.json({ hasOwner: count > 0 });
}
