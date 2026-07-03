import { and, asc, eq, gte, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { appointments, leads } from "@/lib/db/schema";
import { createCalendarGateway } from "@/lib/integrations/calendar";

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
      leadName: leads.drivingSchoolName,
      pushName: leads.pushName,
      phone: leads.phone,
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
      phone: appointment.phone,
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
