/*
 * Minimal allow-list HTML sanitizer for rich text stored in ERPNext
 * (Text Editor fields, comments, emails). Parsing happens in an inert
 * DOMParser document, so nothing in the input executes while it is cleaned.
 */

const ALLOWED_TAGS = new Set([
  'a', 'b', 'strong', 'i', 'em', 'u', 's', 'p', 'br', 'hr', 'span', 'div', 'blockquote', 'code', 'pre',
  'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'img', 'sub', 'sup',
]);
const DROP_WITH_CONTENT = new Set(['script', 'style', 'iframe', 'object', 'embed', 'template', 'noscript', 'svg', 'math', 'form', 'input', 'button', 'textarea', 'select']);

function safeUrl(value: string, allowData = false) {
  const url = value.trim();
  if (/^(https?:|mailto:|tel:|\/|#)/i.test(url)) return url;
  if (allowData && /^data:image\/(png|jpe?g|gif|webp);/i.test(url)) return url;
  return null;
}

function clean(node: Node, out: Document): Node | null {
  if (node.nodeType === Node.TEXT_NODE) return out.createTextNode(node.textContent || '');
  if (node.nodeType !== Node.ELEMENT_NODE) return null;
  const element = node as Element;
  const tag = element.tagName.toLowerCase();
  if (DROP_WITH_CONTENT.has(tag)) return null;

  const children = Array.from(element.childNodes).map((child) => clean(child, out)).filter(Boolean) as Node[];
  if (!ALLOWED_TAGS.has(tag)) {
    // Unknown wrapper: keep its text content, drop the element itself.
    const fragment = out.createDocumentFragment();
    children.forEach((child) => fragment.appendChild(child));
    return fragment;
  }

  const copy = out.createElement(tag);
  if (tag === 'a') {
    const href = safeUrl(element.getAttribute('href') || '');
    if (href) copy.setAttribute('href', href);
    copy.setAttribute('target', '_blank');
    copy.setAttribute('rel', 'noopener noreferrer');
  }
  if (tag === 'img') {
    const src = safeUrl(element.getAttribute('src') || '', true);
    if (!src) return null;
    copy.setAttribute('src', src);
    copy.setAttribute('alt', element.getAttribute('alt') || '');
  }
  if ((tag === 'td' || tag === 'th') && element.getAttribute('colspan')) copy.setAttribute('colspan', String(Number(element.getAttribute('colspan')) || 1));
  children.forEach((child) => copy.appendChild(child));
  return copy;
}

export function sanitizeHtml(value: unknown): string {
  if (typeof value !== 'string' || !value) return '';
  const source = new DOMParser().parseFromString(value, 'text/html');
  const out = document.implementation.createHTMLDocument('');
  const container = out.createElement('div');
  Array.from(source.body.childNodes).forEach((node) => {
    const cleaned = clean(node, out);
    if (cleaned) container.appendChild(cleaned);
  });
  return container.innerHTML;
}

/** Escape plain text for safe insertion into HTML (e.g. a comment typed by the user). */
export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] as string);
}
