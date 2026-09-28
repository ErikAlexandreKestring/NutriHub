import { forwardRef, type InputHTMLAttributes } from 'react';
import { completarHorario, mascararHorario } from '@/lib/formato';
import { Campo } from './Campo';

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  rotulo: string;
  erro?: string;
  value: string;
  onChange: (horario: string) => void;
}

/**
 * Horário sempre em 24h (HH:MM). O `<input type="time">` foi abandonado porque
 * o formato dele segue o idioma do navegador/sistema, não o da página: num
 * sistema em inglês aparecia AM/PM. Aqui é texto com máscara e teclado
 * numérico no celular.
 */
export const CampoDeHorario = forwardRef<HTMLInputElement, Props>(function CampoDeHorario(
  { value, onChange, onBlur, ...props },
  ref,
) {
  return (
    <Campo
      {...props}
      ref={ref}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder="HH:MM"
      maxLength={5}
      value={value}
      onChange={(e) => onChange(mascararHorario(e.target.value))}
      onBlur={(e) => {
        const completo = completarHorario(value);
        if (completo !== value) onChange(completo);
        onBlur?.(e);
      }}
    />
  );
});
