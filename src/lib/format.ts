/** Русское согласование числительных: 1 фрагмент, 2 фрагмента, 5 фрагментов. */
export function plural(n: number, one: string, few: string, many: string): string {
  const mod100 = Math.abs(n) % 100;
  const mod10 = mod100 % 10;
  if (mod100 >= 11 && mod100 <= 14) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

/** Мелкие суммы не округляем в ноль — автор должен видеть порядок цены. */
export function usd(value: number): string {
  if (value === 0) return '$0';
  if (value < 0.001) return '<$0.001';
  return `$${value.toFixed(value < 1 ? 3 : 2)}`;
}
