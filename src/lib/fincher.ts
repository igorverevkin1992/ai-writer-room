/**
 * Разбор ответа режима 6: переписанная сцена + список вырезанного.
 * `\b` здесь неприменим — граница слова в JS определена по ASCII,
 * а заголовки кириллические.
 */
const CUT_HEADING = /^[ \t]*#{0,4}[ \t]*(?:\*\*)?(?:ЧТО[ \t]+)?ВЫРЕЗАНО.*$/im;
const SCENE_HEADING = /^[ \t]*#{0,4}[ \t]*(?:\*\*)?(?:ПЕРЕПИСАННАЯ[ \t]+)?СЦЕНА.*$/im;

export function splitFincherAnswer(text: string): { rewritten: string; cuts: string } {
  const match = CUT_HEADING.exec(text);
  if (!match) return { rewritten: text.trim(), cuts: '' };
  const rewritten = text.slice(0, match.index).replace(SCENE_HEADING, '').trim();
  return { rewritten, cuts: text.slice(match.index + match[0].length).trim() };
}
