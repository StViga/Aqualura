import { NextRequest, NextResponse } from "next/server";

import { requireUserFromRequest } from "@/lib/auth";
import { userToDto } from "@/lib/serializers";

export async function GET(request: NextRequest) {
  const user = await requireUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ user: null }, { status: 200 });
  }
  return NextResponse.json({ user: userToDto(user) });
}
