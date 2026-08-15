import { NextResponse } from "next/server";
import { z } from "zod";
import { findSuperAdminByIdentifier, validateSuperAdminPassword } from "@/lib/auth/super-admins";

const loginSchema = z.object({
  identifier: z.string().trim().min(3),
  password: z.string().min(6),
});

export async function POST(request: Request) {
  try {
    const input = loginSchema.parse(await request.json());
    const user = findSuperAdminByIdentifier(input.identifier);

    if (!user) {
      return NextResponse.json({ ok: false, error: "unauthorized_user" }, { status: 401 });
    }

    const legacySharedPassword = process.env.FXP_SUPER_ADMIN_PASSWORD?.trim();
    const hasValidIndividualPassword = validateSuperAdminPassword(user, input.password);
    const hasValidLegacyPassword = Boolean(legacySharedPassword && input.password === legacySharedPassword);

    if (!hasValidIndividualPassword && !hasValidLegacyPassword) {
      return NextResponse.json({ ok: false, error: "invalid_password" }, { status: 401 });
    }

    return NextResponse.json({
      ok: true,
      user: {
        name: user.name,
        identifier: user.identifier,
        role: user.role,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ ok: false, error: "invalid_login", issues: error.issues }, { status: 400 });
    }

    const message = error instanceof Error ? error.message : "Erro inesperado.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
