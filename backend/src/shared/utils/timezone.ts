// Fuso fixo (em vez do fuso do processo) para que a checagem contra a grade
// (RN-08) dê o mesmo resultado independente de onde o servidor rode — em um
// deploy com o processo em UTC, um horário dentro do expediente de Brasília
// não pode ser recusado por ter sido comparado contra a hora UTC.
export const TIMEZONE = 'America/Sao_Paulo';

const WEEKDAY_TO_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

const zonedParts = new Intl.DateTimeFormat('en-US', {
  timeZone: TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

function partsOf(date: Date): Record<string, string> {
  return Object.fromEntries(zonedParts.formatToParts(date).map((part) => [part.type, part.value]));
}

// Extrai o dia da semana (0=domingo..6=sábado, mesma convenção de
// availability.day_of_week) e o horário (HH:MM), sempre no fuso de TIMEZONE.
export function getZonedDayAndTime(date: Date): { dayOfWeek: number; timeOfDay: string } {
  const parts = partsOf(date);
  return { dayOfWeek: WEEKDAY_TO_INDEX[parts.weekday], timeOfDay: `${parts.hour}:${parts.minute}` };
}

/** Data do calendário (AAAA-MM-DD) de `date` no fuso de TIMEZONE. */
export function getZonedDate(date: Date): string {
  const parts = partsOf(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

// Quanto o relógio de TIMEZONE está à frente do UTC no instante dado (negativo
// no Brasil). Calculado pelo Intl, e não fixo em -03:00, para não depender de
// o país continuar sem horário de verão.
function offsetMs(date: Date): number {
  const p = partsOf(date);
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/**
 * Instante UTC de uma data (AAAA-MM-DD) e hora (HH:MM) de parede em TIMEZONE.
 * A segunda passada corrige o caso em que o palpite inicial cai do outro lado
 * de uma troca de fuso.
 */
export function zonedDateTimeToUtc(date: string, time: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const wallClock = Date.UTC(year, month - 1, day, hour, minute);

  const firstGuess = wallClock - offsetMs(new Date(wallClock));
  const corrected = wallClock - offsetMs(new Date(firstGuess));
  return new Date(corrected);
}

/** Dia da semana (0=domingo) de uma data de calendário — não depende de fuso. */
export function dayOfWeekOf(date: string): number {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function addDays(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}
