import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireUserFromRequest } from "@/lib/auth";
import { aquariumToDto } from "@/lib/serializers";
import { deleteAquarium, getAquarium, updateAquarium } from "@/services/aquariumService";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  volumeLiters: z.number().positive().optional(),
  description: z.string().optional(),
});

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ aquariumId: string }> },
) {
  const user = await requireUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }
  const { aquariumId } = await context.params;
  const aquarium = getAquarium(user.id, aquariumId);
  if (!aquarium) {
    return NextResponse.json({ error: "Аквариум не найден" }, { status: 404 });
  }
  return NextResponse.json({ aquarium: aquariumToDto(aquarium) });
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ aquariumId: string }> },
) {
  const user = await requireUserFromRequest(request);
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
  const { aquariumId } = await context.params;
  const aquarium = updateAquarium(user, aquariumId, parsed.data);
  if (!aquarium) {
    return NextResponse.json({ error: "Аквариум не найден" }, { status: 404 });
  }
  return NextResponse.json({ aquarium: aquariumToDto(aquarium) });
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ aquariumId: string }> },
) {
  const user = await requireUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }
  const { aquariumId } = await context.params;
  const deleted = deleteAquarium(user.id, aquariumId);
  if (!deleted) {
    return NextResponse.json({ error: "Аквариум не найден" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
