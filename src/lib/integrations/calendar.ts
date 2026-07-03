import { and, gt, inArray, lt, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { appointments } from "@/lib/db/schema";

export interface CalendarSlot {
  startsAt: Date;
  endsAt: Date;
  label: string;
}

export interface CalendarGateway {
  getAvailableSlots(): Promise<CalendarSlot[]>;
  createEvent(input: { startsAt: Date; endsAt: Date; leadName: string; phone: string }): Promise<{ eventId: string }>;
}

export function createCalendarGateway(): CalendarGateway {
  return new InternalCalendarGateway();
}

export class InternalCalendarGateway implements CalendarGateway {
  async getAvailableSlots(): Promise<CalendarSlot[]> {
    const candidates = buildCandidateSlots();
    const lastCandidate = candidates.at(-1);
    if (!lastCandidate) return [];

    const busyAppointments = await db
      .select({
        startsAt: appointments.startsAt,
        endsAt: appointments.endsAt,
      })
      .from(appointments)
      .where(
        and(
          eq(appointments.isDeleted, false),
          inArray(appointments.status, ["scheduled", "rescheduled"]),
          gt(appointments.endsAt, new Date()),
          lt(appointments.startsAt, lastCandidate.endsAt),
        ),
      )
      .catch((error) => {
        console.error("[Internal calendar] Failed to read busy appointments", error);
        return [];
      });

    return candidates
      .filter((slot) =>
        busyAppointments.every(
          (appointment) => slot.endsAt <= appointment.startsAt || slot.startsAt >= appointment.endsAt,
        ),
      )
      .slice(0, 5);
  }

  async createEvent(): Promise<{ eventId: string }> {
    return { eventId: `fxphub-${crypto.randomUUID()}` };
  }
}

function buildCandidateSlots(): CalendarSlot[] {
  const now = new Date();
  const slots: CalendarSlot[] = [];
  const businessHoursByDay = new Map<number, number[]>([
    [1, [9, 11, 14]],
    [2, [9, 11, 14]],
    [3, [9, 11, 15]],
    [4, [13, 16, 18]],
    [5, [13, 16, 17]],
  ]);

  for (let offset = 0; offset < 10; offset += 1) {
    const date = new Date(now);
    date.setDate(now.getDate() + offset);
    const weekday = date.getDay();
    const hours = businessHoursByDay.get(weekday) ?? [];

    for (const hour of hours) {
      const startsAt = new Date(date);
      startsAt.setHours(hour, 0, 0, 0);
      if (startsAt <= now) continue;

      const endsAt = new Date(startsAt);
      endsAt.setMinutes(endsAt.getMinutes() + 30);

      slots.push({
        startsAt,
        endsAt,
        label: `${formatDay(startsAt)} as ${String(hour).padStart(2, "0")}h`,
      });
    }
  }

  return slots.slice(0, 8);
}

function formatDay(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Sao_Paulo",
  })
    .format(date)
    .replace(".", "");
}
