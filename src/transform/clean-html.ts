import { decode } from 'he';
import { parseHTML } from 'linkedom';
import { normalizeLinks } from './normalize-links';

export function decodeEntities(input: string): string {
  return decode(input);
}

export function stripStyleTags(input: string): string {
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/\sstyle=("[^"]*"|'[^']*')/gi, '')
    .replace(/<span\b[^>]*>\s*<\/span>/gi, '');
}

function mapSafeTags(input: string): string {
  const { document } = parseHTML(`<div id="root">${input}</div>`);
  const root = document.getElementById('root');
  if (!root) return input;

  const links = root.querySelectorAll('a[href]');
  for (const link of links) {
    const text = link.textContent?.trim() || link.getAttribute('href') || '';
    const href = link.getAttribute('href') || '';
    link.replaceWith(document.createTextNode(`[${text}](${href})`));
  }

  const emNodes = root.querySelectorAll('em, i');
  for (const em of emNodes) {
    const text = em.textContent ?? '';
    em.replaceWith(document.createTextNode(`*${text}*`));
  }

  const strongNodes = root.querySelectorAll('strong, b');
  for (const strong of strongNodes) {
    const text = strong.textContent ?? '';
    strong.replaceWith(document.createTextNode(`**${text}**`));
  }

  const brNodes = root.querySelectorAll('br');
  for (const br of brNodes) {
    br.replaceWith(document.createTextNode('\n\n'));
  }

  return root.innerHTML
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/([^\n])\n(#{1,6}\s)/g, '$1\n\n$2')
    .trim();
}

export function cleanContent(input: string, baseUrl: string): string {
  const decoded = decodeEntities(input);
  const stripped = stripStyleTags(decoded);
  const mapped = mapSafeTags(stripped);
  return normalizeLinks(mapped, baseUrl);
}
