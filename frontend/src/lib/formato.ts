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

/** "AAAA-MM-DD" de um instante, no fuso da aplicação — chave para agrupar por dia. */
export function diaDe(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: FUSO }).format(new Date(iso));
}

/** Soma dias a uma data "AAAA-MM-DD" sem passar por fuso nenhum. */
export function somarDias(data: string, dias: number): string {
  const [ano, mes, dia] = data.split('-').map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia + dias)).toISOString().slice(0, 10);
}

const diaPorExtenso = new Intl.DateTimeFormat('pt-BR', {
  timeZone: FUSO,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

const diaAbreviado = new Intl.DateTimeFormat('pt-BR', {
  timeZone: FUSO,
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
});

/** "segunda-feira, 5 de outubro" — cabeçalho de um dia na agenda. */
export function formatarDiaPorExtenso(iso: string): string {
  const texto = diaPorExtenso.format(new Date(iso));
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** "seg., 05/10" — rótulo curto para escolher o dia no celular. */
export function formatarDiaAbreviado(iso: string): string {
  return diaAbreviado.format(new Date(iso));
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

/**
 * Máscara 24h para os campos de horário (HH:MM). Substitui o `<input
 * type="time">`, que segue o idioma do navegador/sistema e mostra AM/PM num
 * sistema em inglês mesmo com a página em pt-BR.
 *
 * Aceita "1230" → "12:30" e "7:30" → "07:30". Não valida a faixa (25:00): isso
 * é do backend, que devolve o erro no campo.
 */
export function mascararHorario(bruto: string): string {
  if (bruto.includes(':')) {
    const [horas = '', minutos = ''] = bruto.split(':');
    const hh = horas.replace(/\D/g, '').slice(-2);
    const mm = minutos.replace(/\D/g, '').slice(0, 2);
    return hh ? `${hh.padStart(2, '0')}:${mm}` : '';
  }
  const digitos = bruto.replace(/\D/g, '').slice(0, 4);
  return digitos.length > 2 ? `${digitos.slice(0, 2)}:${digitos.slice(2)}` : digitos;
}

/** Ao sair do campo, só a hora ("7" ou "07") vira hora cheia ("07:00"). */
export function completarHorario(valor: string): string {
  return /^\d{1,2}$/.test(valor) ? `${valor.padStart(2, '0')}:00` : valor;
}

/**
 * Plural da medida caseira: flexiona as palavras antes do "de" ou do parêntese
 * ("colher de sopa" → "colheres de sopa", "unidade pequena" → "unidades
 * pequenas", "lata (350 ml)" → "latas (350 ml)").
 */
function pluralDaMedida(nome: string): string {
  const palavras = nome.split(' ');
  const fimDoNucleo = palavras.findIndex((palavra) => ['de', 'da', 'do'].includes(palavra) || palavra.startsWith('('));
  return palavras
    .map((palavra, i) => {
      if (fimDoNucleo !== -1 && i >= fimDoNucleo) return palavra;
      if (/[rsz]$/.test(palavra)) return `${palavra}es`;
      if (palavra.endsWith('ão')) return `${palavra.slice(0, -2)}ões`;
      if (palavra.endsWith('l')) return `${palavra.slice(0, -1)}is`;
      return `${palavra}s`;
    })
    .join(' ');
}

/** "2 unidades" / "½ unidade" / "1,5 colher de sopa" — plural a partir de 2, como na norma. */
export function formatarMedida(quantidade: number | string, nome: string): string {
  const numero = typeof quantidade === 'string' ? Number(quantidade) : quantidade;
  const texto = numero === 0.5 ? '½' : numero.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
  return `${texto} ${numero >= 2 ? pluralDaMedida(nome) : nome}`;
}

/** Quantidade de um item do plano: "2 unidades (150 g)" ou só "150 g". */
export function formatarQuantidade(item: {
  quantidade_g: string;
  medida_nome: string | null;
  quantidade_medida: string | null;
}): string {
  if (item.medida_nome && item.quantidade_medida) {
    return `${formatarMedida(item.quantidade_medida, item.medida_nome)} (${formatarGramas(item.quantidade_g)})`;
  }
  return formatarGramas(item.quantidade_g);
}
