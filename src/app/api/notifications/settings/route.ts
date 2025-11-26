import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireUserFromRequest } from "@/lib/auth";
import { updateNotificationSettings } from "@/services/userService";

const settingsSchema = z.object({
  channel: z.union([z.literal("email"), z.literal("push"), z.literal("off")]).optional(),
  preferredTime: z
    .union([z.literal("morning"), z.literal("evening"), z.literal("any")])
    .optional(),
  timeZone: z.string().optional(),
  muteFeedingReminders: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  const user = requireUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }
  return NextResponse.json({ settings: user.notificationSettings });
}

export async function PATCH(request: NextRequest) {
  const user = requireUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }
  const json = await request.json().catch(() => null);
  const parsed = settingsSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Некорректные настройки", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const updated = updateNotificationSettings(user.id, parsed.data);
  if (!updated) {
    return NextResponse.json({ error: "Не удалось обновить настройки" }, { status: 500 });
  }
  return NextResponse.json({ settings: updated.notificationSettings });
}
