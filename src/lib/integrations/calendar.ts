import { google } from "googleapis";
import { getRuntimeIntegrationSettings } from "@/lib/integrations/settings";

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
  return new RuntimeCalendarGateway();
}

class RuntimeCalendarGateway implements CalendarGateway {
  private readonly staticCalendar = new StaticCalendarGateway();

  async getAvailableSlots(): Promise<CalendarSlot[]> {
    const settings = await getRuntimeIntegrationSettings();
    if (!hasGoogleCalendarConfig(settings)) return this.staticCalendar.getAvailableSlots();
    return new GoogleCalendarGateway(settings).getAvailableSlots();
  }

  async createEvent(input: { startsAt: Date; endsAt: Date; leadName: string; phone: string }) {
    const settings = await getRuntimeIntegrationSettings();
    if (!hasGoogleCalendarConfig(settings)) return this.staticCalendar.createEvent();
    return new GoogleCalendarGateway(settings).createEvent(input);
  }
}

export class StaticCalendarGateway implements CalendarGateway {
  async getAvailableSlots(): Promise<CalendarSlot[]> {
    const now = new Date();
    return [14, 16, 18].map((hour) => {
      const startsAt = new Date(now);
      startsAt.setHours(hour, 0, 0, 0);
      const endsAt = new Date(startsAt);
      endsAt.setMinutes(endsAt.getMinutes() + 30);

      return {
        startsAt,
        endsAt,
        label: `hoje as ${String(hour).padStart(2, "0")}h`,
      };
    });
  }

  async createEvent(): Promise<{ eventId: string }> {
    return { eventId: `local-${crypto.randomUUID()}` };
  }
}

export class GoogleCalendarGateway implements CalendarGateway {
  private readonly calendar;

  constructor(
    private readonly settings: {
      GOOGLE_CALENDAR_ID?: string;
      GOOGLE_SERVICE_ACCOUNT_EMAIL?: string;
      GOOGLE_PRIVATE_KEY?: string;
      GOOGLE_TIME_ZONE?: string;
    },
  ) {
    this.calendar = google.calendar({
      version: "v3",
      auth: new google.auth.JWT({
        email: settings.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        key: settings.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
        scopes: ["https://www.googleapis.com/auth/calendar"],
      }),
    });
  }

  async getAvailableSlots(): Promise<CalendarSlot[]> {
    if (!this.settings.GOOGLE_CALENDAR_ID) throw new Error("GOOGLE_CALENDAR_ID nao configurado.");

    const timeZone = this.settings.GOOGLE_TIME_ZONE ?? "America/Sao_Paulo";
    const candidates = buildCandidateSlots(timeZone);
    const timeMin = candidates[0]?.startsAt;
    const timeMax = candidates.at(-1)?.endsAt;
    if (!timeMin || !timeMax) return [];

    const busy = await this.calendar.freebusy.query({
      requestBody: {
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        timeZone,
        items: [{ id: this.settings.GOOGLE_CALENDAR_ID }],
      },
    });

    const busyRanges = busy.data.calendars?.[this.settings.GOOGLE_CALENDAR_ID]?.busy ?? [];
    return candidates.filter((slot) =>
      busyRanges.every((range) => {
        const busyStart = range.start ? new Date(range.start) : null;
        const busyEnd = range.end ? new Date(range.end) : null;
        if (!busyStart || !busyEnd) return true;
        return slot.endsAt <= busyStart || slot.startsAt >= busyEnd;
      }),
    );
  }

  async createEvent(input: {
    startsAt: Date;
    endsAt: Date;
    leadName: string;
    phone: string;
  }): Promise<{ eventId: string }> {
    if (!this.settings.GOOGLE_CALENDAR_ID) throw new Error("GOOGLE_CALENDAR_ID nao configurado.");

    const timeZone = this.settings.GOOGLE_TIME_ZONE ?? "America/Sao_Paulo";

    const event = await this.calendar.events.insert({
      calendarId: this.settings.GOOGLE_CALENDAR_ID,
      requestBody: {
        summary: `Reuniao fxphub - ${input.leadName}`,
        description: `Lead: ${input.leadName}\nTelefone: ${input.phone}\nOrigem: fxphub IA`,
        start: {
          dateTime: input.startsAt.toISOString(),
          timeZone,
        },
        end: {
          dateTime: input.endsAt.toISOString(),
          timeZone,
        },
      },
    });

    return { eventId: event.data.id ?? crypto.randomUUID() };
  }
}

function hasGoogleCalendarConfig(settings: {
  GOOGLE_CALENDAR_ID?: string;
  GOOGLE_SERVICE_ACCOUNT_EMAIL?: string;
  GOOGLE_PRIVATE_KEY?: string;
}) {
  return Boolean(settings.GOOGLE_CALENDAR_ID && settings.GOOGLE_SERVICE_ACCOUNT_EMAIL && settings.GOOGLE_PRIVATE_KEY);
}

function buildCandidateSlots(timeZone = "America/Sao_Paulo"): CalendarSlot[] {
  const now = new Date();
  const slots: CalendarSlot[] = [];
  const businessHoursByDay = new Map<number, number[]>([
    [1, [9, 11, 14]],
    [2, [9, 11, 14]],
    [3, [9, 11, 15]],
    [4, [13, 16, 18, 20]],
    [5, [13, 16, 17, 20]],
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
        label: `${formatDay(startsAt, timeZone)} as ${String(hour).padStart(2, "0")}h`,
      });
    }
  }

  return slots.slice(0, 8);
}

function formatDay(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    timeZone,
  })
    .format(date)
    .replace(".", "");
}
