import { and, asc, eq, gte, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { appointments, leads } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { createCalendarGateway } from "@/lib/integrations/calendar";

const updateAppointmentSchema = z.object({
  id: z.string().uuid(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
});

const deleteAppointmentSchema = z.object({
  id: z.string().uuid(),
});

export async function GET() {
  const now = new Date();
  const calendar = createCalendarGateway();
  const availableSlots = await calendar.getAvailableSlots();

  let databaseAvailable = true;
  const scheduledAppointments = await db
    .select({
      id: appointments.id,
      leadId: appointments.leadId,
      startsAt: appointments.startsAt,
      endsAt: appointments.endsAt,
      status: appointments.status,
      responsibleName: leads.responsibleName,
      leadName: leads.drivingSchoolName,
      pushName: leads.pushName,
      phone: leads.phone,
      city: leads.city,
      runsPaidTraffic: leads.runsPaidTraffic,
      mainPain: leads.mainPain,
    })
    .from(appointments)
    .leftJoin(leads, eq(appointments.leadId, leads.id))
    .where(
      and(
        eq(appointments.isDeleted, false),
        inArray(appointments.status, ["scheduled", "rescheduled"]),
        gte(appointments.endsAt, now),
      ),
    )
    .orderBy(asc(appointments.startsAt))
    .limit(30)
    .catch((error) => {
      databaseAvailable = false;
      console.error("[Appointments calendar] Failed to load appointments", error);
      return [];
    });

  return NextResponse.json({
    ok: true,
    mode: "internal",
    databaseAvailable,
    appointments: scheduledAppointments.map((appointment) => ({
      id: appointment.id,
      leadId: appointment.leadId,
      leadName: appointment.leadName ?? appointment.pushName ?? "Lead fxphub",
      responsibleName: appointment.responsibleName ?? appointment.pushName ?? "Nao informado",
      phone: appointment.phone,
      city: appointment.city,
      runsPaidTraffic: appointment.runsPaidTraffic,
      mainPain: appointment.mainPain,
      startsAt: appointment.startsAt.toISOString(),
      endsAt: appointment.endsAt.toISOString(),
      status: appointment.status,
    })),
    availableSlots: availableSlots.map((slot) => ({
      startsAt: slot.startsAt.toISOString(),
      endsAt: slot.endsAt.toISOString(),
      label: slot.label,
    })),
  });
}

export async function PATCH(request: Request) {
  try {
    const input = updateAppointmentSchema.parse(await request.json());
    const startsAt = new Date(input.startsAt);
    const endsAt = new Date(input.endsAt);

    if (endsAt <= startsAt) {
      return NextResponse.json({ ok: false, error: "invalid_schedule_range" }, { status: 400 });
    }

    const [appointment] = await db
      .update(appointments)
      .set({
        startsAt,
        endsAt,
        status: "rescheduled",
        updatedAt: new Date(),
        modifiedBy: env.SYSTEM_USER_ID,
      })
      .where(and(eq(appointments.id, input.id), eq(appointments.isDeleted, false)))
      .returning();

    if (!appointment) {
      return NextResponse.json({ ok: false, error: "appointment_not_found" }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      appointment: {
        id: appointment.id,
        startsAt: appointment.startsAt.toISOString(),
        endsAt: appointment.endsAt.toISOString(),
        status: appointment.status,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ ok: false, error: "invalid_appointment_update", issues: error.issues }, { status: 400 });
    }

    const message = error instanceof Error ? error.message : "Erro ao atualizar agendamento.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const input = deleteAppointmentSchema.parse(await request.json());
    const [appointment] = await db
      .update(appointments)
      .set({
        status: "cancelled",
        isDeleted: true,
        deletedAt: new Date(),
        updatedAt: new Date(),
        modifiedBy: env.SYSTEM_USER_ID,
      })
      .where(and(eq(appointments.id, input.id), eq(appointments.isDeleted, false)))
      .returning();

    if (!appointment) {
      return NextResponse.json({ ok: false, error: "appointment_not_found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, id: appointment.id });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ ok: false, error: "invalid_appointment_delete", issues: error.issues }, { status: 400 });
    }

    const message = error instanceof Error ? error.message : "Erro ao apagar agendamento.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
