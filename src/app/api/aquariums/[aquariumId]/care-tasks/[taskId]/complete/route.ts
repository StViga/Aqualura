import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireUserFromRequest } from "@/lib/auth";
import { careTaskToDto } from "@/lib/serializers";
import { markTaskComplete } from "@/services/aquariumService";

const completeSchema = z.object({
  measurements: z
    .record(z.string(), z.number().nonnegative().max(1000))
    .optional(),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ aquariumId: string; taskId: string }> },
) {
  const user = await requireUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }
  const json = await request.json().catch(() => null);
  const parsed = completeSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Некорректные данные", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { aquariumId, taskId } = await context.params;
  const task = markTaskComplete(
    user,
    aquariumId,
    taskId,
    parsed.data.measurements,
  );
  if (!task) {
    return NextResponse.json({ error: "Задача не найдена" }, { status: 404 });
  }
  return NextResponse.json({ task: careTaskToDto(task) });
}
