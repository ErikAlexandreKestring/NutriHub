/**
 * O backend valida a grade de disponibilidade num fuso fixo (America/Sao_Paulo,
 * RN-08). A interface formata no mesmo fuso para que o horário mostrado ao
 * paciente seja o mesmo que o servidor considerou — um celular configurado em
 * outro fuso mostraria uma hora diferente da que foi validada.
 */
const FUSO = 'America/Sao_Paulo';

const dataHoraLonga = new Intl.DateTimeFormat('pt-BR', {
  timeZone: FUSO,
  dateStyle: 'full',
  timeStyle: 'short',
});

const dataCurta = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, dateStyle: 'short' });
const horaCurta = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, timeStyle: 'short' });

export function formatarDataHora(iso: string): string {
  return dataHoraLonga.format(new Date(iso));
}

/**
 * Datas sem hora (`date` do Postgres, ex.: data de nascimento) chegam como
 * "AAAA-MM-DD". Passar isso por `new Date()` interpreta como meia-noite UTC, e
 * no fuso de São Paulo a data exibida recuaria um dia — por isso o texto é
 * remontado sem conversão de fuso.
 */
export function formatarDataSemHora(data: string): string {
  const [ano, mes, dia] = data.slice(0, 10).split('-');
  if (!ano || !mes || !dia) return data;
  return `${dia}/${mes}/${ano}`;
}

/** "AAAA-MM-DD" de hoje no fuso da aplicação — limite do campo de nascimento. */
export function hojeSemHora(): string {
  // en-CA formata como AAAA-MM-DD, que é o que o <input type="date"> espera.
  return new Intl.DateTimeFormat('en-CA', { timeZone: FUSO }).format(new Date());
}

export function formatarData(iso: string): string {
  return dataCurta.format(new Date(iso));
}

export function formatarHora(iso: string): string {
  return horaCurta.format(new Date(iso));
}

const DIAS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

export function nomeDoDia(dayOfWeek: number): string {
  return DIAS[dayOfWeek] ?? `Dia ${dayOfWeek}`;
}

export const DIAS_DA_SEMANA = DIAS.map((nome, valor) => ({ valor, nome }));

/** Corta o `:ss` que o Postgres devolve em colunas `time` (ex.: 08:00:00). */
export function formatarHorario(time: string): string {
  return time.slice(0, 5);
}

export function ehFutura(iso: string): boolean {
  return new Date(iso).getTime() > Date.now();
}

/**
 * Colunas `decimal` chegam como string ("192.00"). Arredonda para inteiro no
 * caso das calorias e para uma casa nos macros, que é a precisão que o paciente
 * consegue usar — grama fracionada em dieta é ruído.
 */
export function formatarKcal(valor: number | string | null): string {
  const numero = typeof valor === 'string' ? Number(valor) : valor;
  if (numero === null || !Number.isFinite(numero)) return '—';
  return `${Math.round(numero).toLocaleString('pt-BR')} kcal`;
}

export function formatarGramas(valor: number | string | null): string {
  const numero = typeof valor === 'string' ? Number(valor) : valor;
  if (numero === null || !Number.isFinite(numero)) return '—';
  return `${numero.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} g`;
}
