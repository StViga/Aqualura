import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createSession, attachSessionCookie } from "@/lib/auth";
import { userToDto } from "@/lib/serializers";
import { registerUser } from "@/services/userService";

const registerSchema = z.object({
  email: z.string().email("Введите корректный email"),
  password: z.string().min(8, "Пароль должен быть не короче восьми символов"),
  displayName: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const json = await request.json().catch(() => null);
  const parsed = registerSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Некорректные данные", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const result = registerUser(parsed.data);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 409 });
  }

  const session = createSession(result.user.id);
  const response = NextResponse.json({ user: userToDto(result.user) }, { status: 201 });
  return attachSessionCookie(response, session);
}
