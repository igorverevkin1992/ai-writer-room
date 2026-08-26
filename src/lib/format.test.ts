import { describe, expect, it } from 'vitest';
import { plural, usd } from './format';

describe('plural', () => {
  it('согласует числительные', () => {
    const f = (n: number) => `${n} ${plural(n, 'фрагмент', 'фрагмента', 'фрагментов')}`;
    expect(f(1)).toBe('1 фрагмент');
    expect(f(2)).toBe('2 фрагмента');
    expect(f(5)).toBe('5 фрагментов');
    expect(f(11)).toBe('11 фрагментов');
    expect(f(21)).toBe('21 фрагмент');
    expect(f(114)).toBe('114 фрагментов');
    expect(f(122)).toBe('122 фрагмента');
  });
});

describe('usd', () => {
  it('не округляет мелкие суммы в ноль', () => {
    expect(usd(0)).toBe('$0');
    expect(usd(0.0004)).toBe('<$0.001');
    expect(usd(0.152)).toBe('$0.152');
    expect(usd(2.5)).toBe('$2.50');
  });
});
