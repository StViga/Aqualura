import { NextRequest, NextResponse } from "next/server";

import { requireUserFromRequest } from "@/lib/auth";
import { careTaskToDto } from "@/lib/serializers";
import { getAquarium } from "@/services/aquariumService";

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
  return NextResponse.json({ tasks: aquarium.careTasks.map(careTaskToDto) });
}
