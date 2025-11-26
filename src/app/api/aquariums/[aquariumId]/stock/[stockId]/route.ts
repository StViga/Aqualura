import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireUserFromRequest } from "@/lib/auth";
import { aquariumToDto } from "@/lib/serializers";
import { removeFishFromAquarium, updateStockQuantity } from "@/services/aquariumService";

const updateSchema = z.object({
  quantity: z.number().int().positive(),
});

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ aquariumId: string; stockId: string }> },
) {
  const user = requireUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }
  const json = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Некорректные данные", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { aquariumId, stockId } = await context.params;
  try {
    const aquarium = updateStockQuantity(
      user,
      aquariumId,
      stockId,
      parsed.data.quantity,
    );
    if (!aquarium) {
      return NextResponse.json({ error: "Вид не найден" }, { status: 404 });
    }
    return NextResponse.json({ aquarium: aquariumToDto(aquarium) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Не удалось обновить количество" },
      { status: 400 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ aquariumId: string; stockId: string }> },
) {
  const user = requireUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }
  const { aquariumId, stockId } = await context.params;
  const aquarium = removeFishFromAquarium(user, aquariumId, stockId);
  if (!aquarium) {
    return NextResponse.json({ error: "Ресурс не найден" }, { status: 404 });
  }
  return NextResponse.json({ aquarium: aquariumToDto(aquarium) });
}
