export interface CalendarSlot {
  startsAt: Date;
  endsAt: Date;
  label: string;
}

export interface CalendarGateway {
  getAvailableSlots(): Promise<CalendarSlot[]>;
  createEvent(input: { startsAt: Date; endsAt: Date; leadName: string; phone: string }): Promise<{ eventId: string }>;
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
