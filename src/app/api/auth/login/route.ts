import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { attachSessionCookie, createSession } from "@/lib/auth";
import { userToDto } from "@/lib/serializers";
import { authenticateUser } from "@/services/userService";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const json = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Некорректные данные входа", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const user = authenticateUser(parsed.data.email, parsed.data.password);
  if (!user) {
    return NextResponse.json(
      { error: "Неверный email или пароль" },
      { status: 401 },
    );
  }
  const session = createSession(user.id);
  const response = NextResponse.json({ user: userToDto(user) });
  return attachSessionCookie(response, session);
}
