import { NextRequest, NextResponse } from "next/server";

import { requireUserFromRequest } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const user = await requireUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }
  return NextResponse.json({ subscription: user.subscription });
}
