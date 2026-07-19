import { and, gt, inArray, lt, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { appointments } from "@/lib/db/schema";
import { getSaoPauloHour } from "@/lib/crm/scheduling";

export interface CalendarSlot {
  startsAt: Date;
  endsAt: Date;
  label: string;
}

export interface CalendarSlotQuery {
  preferredHours?: number[];
}

export interface CalendarGateway {
  getAvailableSlots(query?: CalendarSlotQuery): Promise<CalendarSlot[]>;
  createEvent(input: { startsAt: Date; endsAt: Date; leadName: string; phone: string }): Promise<{ eventId: string }>;
}

export function createCalendarGateway(): CalendarGateway {
  return new InternalCalendarGateway();
}

export class InternalCalendarGateway implements CalendarGateway {
  async getAvailableSlots(query: CalendarSlotQuery = {}): Promise<CalendarSlot[]> {
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

    const availableSlots = candidates
      .filter((slot) =>
        busyAppointments.every(
          (appointment) => slot.endsAt <= appointment.startsAt || slot.startsAt >= appointment.endsAt,
        ),
      );

    const preferredHours = new Set(query.preferredHours ?? []);
    if (preferredHours.size === 0) return availableSlots.slice(0, 5);

    const preferredSlots = availableSlots.filter((slot) => preferredHours.has(getSaoPauloHour(slot.startsAt)));
    const fallbackSlots = availableSlots.filter((slot) => !preferredHours.has(getSaoPauloHour(slot.startsAt)));
    return [...preferredSlots, ...fallbackSlots].slice(0, 5);
  }

  async createEvent(): Promise<{ eventId: string }> {
    return { eventId: `fxphub-${crypto.randomUUID()}` };
  }
}

function buildCandidateSlots(): CalendarSlot[] {
  const now = new Date();
  const slots: CalendarSlot[] = [];
  const today = getSaoPauloDateParts(now);
  const todayStart = createSaoPauloDate(today.year, today.month, today.day, 0);
  const businessHoursByDay = new Map<number, number[]>([
    [1, [9, 10, 11, 13, 14, 15, 16, 17]],
    [2, [9, 10, 11, 13, 14, 15, 16, 17]],
    [3, [9, 10, 11, 13, 14, 15, 16, 17]],
    [4, [9, 10, 11, 13, 14, 15, 16, 17]],
    [5, [9, 10, 11, 13, 14, 15, 16, 17]],
  ]);

  for (let offset = 0; offset < 10; offset += 1) {
    const date = new Date(todayStart);
    date.setUTCDate(todayStart.getUTCDate() + offset);
    const dateParts = getSaoPauloDateParts(date);
    const weekday = getSaoPauloWeekday(date);
    const hours = businessHoursByDay.get(weekday) ?? [];

    for (const hour of hours) {
      const startsAt = createSaoPauloDate(dateParts.year, dateParts.month, dateParts.day, hour);
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

  return slots;
}

function createSaoPauloDate(year: number, month: number, day: number, hour: number) {
  return new Date(
    `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:00:00-03:00`,
  );
}

function getSaoPauloDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).formatToParts(date);

  return {
    year: Number(parts.find((part) => part.type === "year")?.value),
    month: Number(parts.find((part) => part.type === "month")?.value),
    day: Number(parts.find((part) => part.type === "day")?.value),
  };
}

function getSaoPauloWeekday(date: Date) {
  const weekday = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    timeZone: "America/Sao_Paulo",
  }).format(date);

  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekday);
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
