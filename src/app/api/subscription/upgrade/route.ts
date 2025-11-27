import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireUserFromRequest } from "@/lib/auth";
import { upgradeToPremium } from "@/services/userService";

const upgradeSchema = z.object({
  months: z.number().int().positive().default(1),
  aquariumLimit: z.number().int().min(1).max(20).optional(),
});

export async function POST(request: NextRequest) {
  const user = await requireUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }
  const json = await request.json().catch(() => null);
  const parsed = upgradeSchema.safeParse(json ?? {});
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Некорректные параметры", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const upgraded = upgradeToPremium(
    user.id,
    parsed.data.months,
    parsed.data.aquariumLimit ?? 5,
  );
  if (!upgraded) {
    return NextResponse.json({ error: "Не удалось обновить тариф" }, { status: 500 });
  }
  return NextResponse.json({ subscription: upgraded.subscription });
}
