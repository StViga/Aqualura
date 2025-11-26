import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireUserFromRequest } from "@/lib/auth";
import { aquariumToDto } from "@/lib/serializers";
import { createAquarium, listAquariums } from "@/services/aquariumService";

const createSchema = z.object({
  name: z.string().min(1),
  volumeLiters: z.number().positive(),
  description: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const user = requireUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }
  const aquariums = listAquariums(user.id).map(aquariumToDto);
  return NextResponse.json({ aquariums });
}

export async function POST(request: NextRequest) {
  const user = requireUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }
  const json = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Некорректные данные", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  try {
    const aquarium = createAquarium(user, parsed.data);
    return NextResponse.json({ aquarium: aquariumToDto(aquarium) }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Не удалось создать аквариум" },
      { status: 403 },
    );
  }
}
