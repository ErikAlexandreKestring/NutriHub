import { env } from '../../config/env';
import { MealRemindersJob } from './mealReminders.job';
import { MealRemindersService } from './mealReminders.service';

export { MealRemindersJob } from './mealReminders.job';

// O relógio é conferido a cada minuto; a varredura de verdade roda uma vez por dia.
const INTERVALO_MS = 60_000;

export function createMealRemindersJob(): MealRemindersJob {
  return new MealRemindersJob({
    service: new MealRemindersService(),
    horario: env.notifications.mealReminderTime,
    intervalMs: INTERVALO_MS,
  });
}
