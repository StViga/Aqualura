import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireUserFromRequest } from "@/lib/auth";
import { aquariumToDto } from "@/lib/serializers";
import { addFishToAquarium } from "@/services/aquariumService";

const addSchema = z.object({
  speciesId: z.string().min(1),
  quantity: z.number().int().positive(),
  sizeClass: z.union([
    z.literal("juvenile"),
    z.literal("medium"),
    z.literal("large"),
  ]).optional(),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ aquariumId: string }> },
) {
  const user = requireUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }
  const json = await request.json().catch(() => null);
  const parsed = addSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Некорректные данные", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  try {
    const { aquariumId } = await context.params;
    const aquarium = addFishToAquarium(user, aquariumId, parsed.data);
    if (!aquarium) {
      return NextResponse.json({ error: "Аквариум не найден" }, { status: 404 });
    }
    return NextResponse.json({ aquarium: aquariumToDto(aquarium) }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Не удалось добавить рыбу" },
      { status: 400 },
    );
  }
}
