import { NextResponse } from "next/server";

import { fishSpeciesCatalog } from "@/data/fishSpecies";
import { fishSpeciesToDto } from "@/lib/serializers";

export async function GET() {
  const species = fishSpeciesCatalog.map(fishSpeciesToDto);
  return NextResponse.json({ species });
}
