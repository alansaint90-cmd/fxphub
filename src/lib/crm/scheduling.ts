export function matchesSlot(text: string, slot: { startsAt: Date; label: string }) {
  const normalizedText = normalizeScheduleText(text);
  const slotHour = getSaoPauloHour(slot.startsAt);
  const hour = `${String(slotHour).padStart(2, "0")}h`;
  const hourWithMinutes = `${String(slotHour).padStart(2, "0")}:00`;
  const selectedHours = extractRequestedHours(normalizedText);
  const requestedDates = extractRequestedDates(normalizedText);
  const requestedWeekdays = extractRequestedWeekdays(normalizedText);
  const date = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(slot.startsAt);
  const hasExplicitDay = requestedDates.length > 0 || requestedWeekdays.length > 0;
  const hasExplicitHour = selectedHours.length > 0;
  const slotMatchesRequestedDay =
    requestedDates.some((requestedDate) => matchesRequestedDate(slot.startsAt, requestedDate)) ||
    requestedWeekdays.includes(getSaoPauloWeekdayNumber(slot.startsAt));
  const slotMatchesRequestedHour =
    selectedHours.includes(slotHour) ||
    normalizedText.includes(normalizeScheduleText(hour)) ||
    normalizedText.includes(normalizeScheduleText(hourWithMinutes));

  if (normalizedText.includes(normalizeScheduleText(slot.label))) return true;
  if (
    normalizedText.includes(normalizeScheduleText(`${date} ${hour}`)) ||
    normalizedText.includes(normalizeScheduleText(`${date} ${hourWithMinutes}`))
  ) {
    return true;
  }

  if (hasExplicitDay && hasExplicitHour) {
    return slotMatchesRequestedDay && slotMatchesRequestedHour;
  }

  if (hasExplicitDay) {
    return false;
  }

  return (
    normalizedText.includes(normalizeScheduleText(hour)) ||
    normalizedText.includes(normalizeScheduleText(hourWithMinutes)) ||
    selectedHours.includes(slotHour)
  );
}

export function isAvailabilityRequest(text: string) {
  const normalizedText = normalizeScheduleText(text);
  const requestedHours = extractRequestedHours(normalizedText);
  const requestedWeekdays = extractRequestedWeekdays(normalizedText);
  const requestedDates = extractRequestedDates(normalizedText);
  if (requestedHours.length === 0 && requestedWeekdays.length === 0 && requestedDates.length === 0) return false;

  return /\b(nao tem|tem|teria|consegue|conseguem|disponivel|livre|outro horario|outros horarios)\b/.test(
    normalizedText,
  ) || requestedWeekdays.length > 0 || requestedDates.length > 0;
}

export function isScheduleRejection(text: string) {
  const normalizedText = normalizeScheduleText(text);

  return /\b(nao consigo|nao posso|nao da|nao quero mais|nenhum|esses horarios nao|esses nao|obrigado|obrigada)\b/.test(
    normalizedText,
  );
}

export function isRescheduleRequest(text: string) {
  const normalizedText = normalizeScheduleText(text);

  return /\b(remarcar|reagendar|mudar horario|trocar horario|mudar a reuniao|trocar a reuniao|outro dia|outro horario)\b/.test(
    normalizedText,
  );
}

export function isCancellationRequest(text: string) {
  const normalizedText = normalizeScheduleText(text);

  return /\b(cancelar|cancela|desmarcar|desmarca|nao vou conseguir participar|nao vou participar)\b/.test(
    normalizedText,
  );
}

export function extractRequestedHours(text: string) {
  const normalizedText = normalizeScheduleText(text);
  const requestedHours = new Set<number>();
  const hourPatterns = [
    /\b(?:as|a|para|pode ser|pode|prefiro|quero|melhor)\s+([01]?\d|2[0-3])\b/g,
    /\b([01]?\d|2[0-3])\s*(?:h|hs|hora|horas|:00)\b/g,
    /^\s*([01]?\d|2[0-3])\s*$/g,
  ];

  for (const pattern of hourPatterns) {
    for (const match of normalizedText.matchAll(pattern)) {
      const hour = Number(match[1]);
      if (Number.isInteger(hour)) requestedHours.add(hour);
    }
  }

  return [...requestedHours];
}

export function extractRequestedWeekdays(text: string) {
  const normalizedText = normalizeScheduleText(text);
  const weekdays = new Set<number>();
  const weekdayMap: Array<[number, RegExp]> = [
    [1, /\b(segunda|seg)\b/],
    [2, /\b(terca|terça|ter)\b/],
    [3, /\b(quarta|qua)\b/],
    [4, /\b(quinta|qui)\b/],
    [5, /\b(sexta|sex)\b/],
  ];

  for (const [weekday, pattern] of weekdayMap) {
    if (pattern.test(normalizedText)) weekdays.add(weekday);
  }

  return [...weekdays];
}

export function extractRequestedDates(text: string) {
  const normalizedText = normalizeScheduleText(text);
  const dates: Array<{ day: number; month?: number }> = [];
  const patterns = [
    /\b(?:dia\s*)?([0-3]?\d)[/-]([01]?\d)\b/g,
    /\bdia\s+([0-3]?\d)(?:\s+(?:do|de)\s+([01]?\d))?\b/g,
    /\b([0-3]?\d)\s+(?:do|de)\s+([01]?\d)\b/g,
  ];

  for (const pattern of patterns) {
    for (const match of normalizedText.matchAll(pattern)) {
      const day = Number(match[1]);
      const month = match[2] ? Number(match[2]) : undefined;
      if (day >= 1 && day <= 31 && (month === undefined || (month >= 1 && month <= 12))) {
        dates.push({ day, month });
      }
    }
  }

  return dates;
}

export function matchesRequestedDate(date: Date, requestedDate: { day: number; month?: number }) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).formatToParts(date);
  const day = Number(parts.find((part) => part.type === "day")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);

  return day === requestedDate.day && (requestedDate.month === undefined || month === requestedDate.month);
}

export function normalizeScheduleText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function getSaoPauloHour(date: Date) {
  return Number(
    new Intl.DateTimeFormat("pt-BR", {
      hour: "2-digit",
      hour12: false,
      timeZone: "America/Sao_Paulo",
    }).format(date),
  );
}

export function getSaoPauloWeekdayNumber(date: Date) {
  const weekday = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    timeZone: "America/Sao_Paulo",
  }).format(date);

  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekday);
}
