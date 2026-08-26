/**
 * Превращение файла в текст. Всё локально: pdf.js и распаковка epub работают
 * в браузере, ни один байт корпуса никуда не отправляется.
 */

export interface ExtractResult {
  text: string;
  note: string;
}

function stripHtml(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/<\/(p|div|h[1-6]|li|br)>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/\n{3,}/g, '\n\n');
}

/** Транскрипты: .srt / .vtt — тайм-коды сохраняем, они станут якорями. */
function parseSubtitles(raw: string): string {
  const blocks = raw.replace(/\r\n?/g, '\n').split(/\n\s*\n+/);
  const out: string[] = [];
  for (const block of blocks) {
    const lines = block.split('\n').filter((l) => l.trim() && !/^WEBVTT/i.test(l));
    if (!lines.length) continue;
    const timeLine = lines.find((l) => /\d{1,2}:\d{2}(:\d{2})?[.,]\d{0,3}\s*-->/.test(l));
    const textLines = lines.filter((l) => l !== timeLine && !/^\d+$/.test(l.trim()));
    if (!textLines.length) continue;
    const stamp = timeLine ? timeLine.split('-->')[0].trim().replace(/[.,]\d+$/, '') : '';
    out.push(`${stamp ? `[${stamp}] ` : ''}${textLines.join(' ')}`);
  }
  // Склеиваем реплики в абзацы примерно по 8 строк, чтобы куски не были рваными.
  const merged: string[] = [];
  for (let i = 0; i < out.length; i += 8) merged.push(out.slice(i, i + 8).join(' '));
  return merged.join('\n\n');
}

async function extractPdf(file: File): Promise<ExtractResult> {
  const pdfjs = await import('pdfjs-dist');
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i += 1) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (text) pages.push(`с. ${i}\n\n${text}`);
  }
  const text = pages.join('\n\n');
  return {
    text,
    note: text.length < doc.numPages * 200
      ? `PDF отдал мало текста (${doc.numPages} страниц): похоже на скан. Нужен OCR — распознайте файл и импортируйте как .txt.`
      : `${doc.numPages} страниц, номера сохранены как якоря.`,
  };
}

async function extractEpub(file: File): Promise<ExtractResult> {
  const { unzipSync, strFromU8 } = await import('fflate');
  const zip = unzipSync(new Uint8Array(await file.arrayBuffer()));
  const names = Object.keys(zip);

  // Порядок глав берём из spine в .opf, иначе — по имени файла.
  const opfName = names.find((n) => n.endsWith('.opf'));
  let ordered = names.filter((n) => /\.x?html?$/i.test(n)).sort();
  if (opfName) {
    const opf = strFromU8(zip[opfName]);
    const manifest = new Map<string, string>();
    for (const m of opf.matchAll(/<item\b[^>]*\/?>/g)) {
      const id = /id="([^"]+)"/.exec(m[0])?.[1];
      const href = /href="([^"]+)"/.exec(m[0])?.[1];
      if (id && href) manifest.set(id, href);
    }
    const base = opfName.includes('/') ? `${opfName.slice(0, opfName.lastIndexOf('/'))}/` : '';
    const spine = [...opf.matchAll(/<itemref\b[^>]*idref="([^"]+)"/g)]
      .map((m) => manifest.get(m[1]))
      .filter((href): href is string => Boolean(href))
      .map((href) => `${base}${href}`.replace(/\/\.\//g, '/'))
      .filter((name) => name in zip);
    if (spine.length) ordered = spine;
  }

  const text = ordered.map((name) => stripHtml(strFromU8(zip[name]))).join('\n\n');
  return { text, note: `${ordered.length} разделов epub.` };
}

export async function fileToText(file: File): Promise<ExtractResult> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.pdf')) return extractPdf(file);
  if (name.endsWith('.epub')) return extractEpub(file);
  const raw = await file.text();
  if (name.endsWith('.srt') || name.endsWith('.vtt')) {
    return { text: parseSubtitles(raw), note: 'Транскрипт: тайм-коды сохранены как якоря.' };
  }
  if (name.endsWith('.html') || name.endsWith('.htm')) {
    return { text: stripHtml(raw), note: 'HTML очищен от разметки.' };
  }
  return { text: raw, note: 'Простой текст.' };
}

export const SUPPORTED_EXTENSIONS = '.txt,.md,.srt,.vtt,.html,.htm,.pdf,.epub,.fountain';
