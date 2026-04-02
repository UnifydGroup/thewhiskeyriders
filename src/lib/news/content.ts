const ALLOWED_TAGS = new Set([
  'p',
  'br',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'blockquote',
  'ul',
  'ol',
  'li',
  'h1',
  'h2',
  'h3',
  'h4',
  'a',
  'img',
  'hr',
]);

const TAG_ALLOWED_ATTRIBUTES: Record<string, Set<string>> = {
  a: new Set(['href', 'target', 'rel']),
  img: new Set(['src', 'alt', 'title']),
};

const BLOCK_TAGS = new Set(['p', 'blockquote', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4']);
const NON_TEXT_CONTENT_TAGS = ['img', 'video', 'audio'];

function hasHtmlTag(value: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(value);
}

function isSafeUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('/')) return true;
  if (trimmed.startsWith('#')) return true;
  if (trimmed.startsWith('mailto:')) return true;
  if (trimmed.startsWith('tel:')) return true;

  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function normalizeUrl(url: string): string | null {
  const trimmed = url.trim();
  if (!isSafeUrl(trimmed)) return null;
  return trimmed;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizePlainTextToHtml(value: string): string {
  const escaped = escapeHtml(value);
  const withLineBreaks = escaped.replace(/\r\n/g, '\n').replace(/\n/g, '<br>');
  return `<p>${withLineBreaks}</p>`;
}

function sanitizeHtmlWithDomParser(rawHtml: string): string {
  if (typeof window === 'undefined') {
    return rawHtml;
  }

  const parser = new DOMParser();
  const document = parser.parseFromString(`<div>${rawHtml}</div>`, 'text/html');
  const wrapper = document.body.firstElementChild as HTMLElement | null;
  if (!wrapper) return '';

  const sanitizeNode = (node: Node) => {
    const children = Array.from(node.childNodes);

    for (const child of children) {
      if (child.nodeType === Node.TEXT_NODE) {
        continue;
      }

      if (child.nodeType !== Node.ELEMENT_NODE) {
        node.removeChild(child);
        continue;
      }

      const element = child as HTMLElement;
      const tagName = element.tagName.toLowerCase();

      if (!ALLOWED_TAGS.has(tagName)) {
        const fragment = document.createDocumentFragment();
        while (element.firstChild) {
          fragment.appendChild(element.firstChild);
        }
        element.replaceWith(fragment);
        continue;
      }

      const allowedAttributes = TAG_ALLOWED_ATTRIBUTES[tagName] || new Set<string>();
      const attributes = Array.from(element.attributes);
      for (const attr of attributes) {
        const attrName = attr.name.toLowerCase();
        if (
          attrName.startsWith('on') ||
          attrName === 'style' ||
          attrName === 'class' ||
          attrName === 'id'
        ) {
          element.removeAttribute(attr.name);
          continue;
        }

        if (!allowedAttributes.has(attrName)) {
          element.removeAttribute(attr.name);
          continue;
        }
      }

      if (tagName === 'a') {
        const href = element.getAttribute('href');
        const normalizedHref = href ? normalizeUrl(href) : null;
        if (!normalizedHref) {
          element.removeAttribute('href');
        } else {
          element.setAttribute('href', normalizedHref);
          element.setAttribute('target', '_blank');
          element.setAttribute('rel', 'noopener noreferrer');
        }
      }

      if (tagName === 'img') {
        const src = element.getAttribute('src');
        const normalizedSrc = src ? normalizeUrl(src) : null;
        if (!normalizedSrc) {
          element.remove();
          continue;
        }
        element.setAttribute('src', normalizedSrc);
        if (!element.getAttribute('alt')) {
          element.setAttribute('alt', '');
        }
      }

      sanitizeNode(element);
    }
  };

  sanitizeNode(wrapper);

  const postProcessed = wrapper.innerHTML
    .replace(/<p>\s*<\/p>/g, '')
    .trim();

  return postProcessed;
}

export function toEditorHtml(content: string): string {
  const raw = (content || '').trim();
  if (!raw) return '';
  if (hasHtmlTag(raw)) return raw;
  return normalizePlainTextToHtml(raw);
}

export function sanitizeNewsHtml(content: string): string {
  const raw = (content || '').trim();
  if (!raw) return '';
  const html = hasHtmlTag(raw) ? raw : normalizePlainTextToHtml(raw);
  return sanitizeHtmlWithDomParser(html);
}

export function toSearchableNewsText(content: string): string {
  const raw = (content || '').trim();
  if (!raw) return '';

  if (typeof window !== 'undefined') {
    const parser = new DOMParser();
    const document = parser.parseFromString(`<div>${raw}</div>`, 'text/html');
    const text = document.body.textContent || '';
    return text.replace(/\s+/g, ' ').trim();
  }

  return raw
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function getCompactPreview(content: string, maxLength = 220): string {
  const text = toSearchableNewsText(content);
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}

export function normalizeEditorHtmlForSave(content: string): string {
  const sanitized = sanitizeNewsHtml(content);
  if (!sanitized) return '';

  const hasBlock = Array.from(BLOCK_TAGS).some((tag) =>
    sanitized.toLowerCase().includes(`<${tag}`)
  );

  if (hasBlock) {
    return sanitized;
  }

  return `<p>${sanitized}</p>`;
}

export function hasRenderableNewsContent(content: string): boolean {
  const sanitized = sanitizeNewsHtml(content);
  if (!sanitized) return false;

  const text = toSearchableNewsText(sanitized);
  if (text.trim().length > 0) {
    return true;
  }

  const lower = sanitized.toLowerCase();
  return NON_TEXT_CONTENT_TAGS.some((tag) => lower.includes(`<${tag}`));
}

export function sanitizeLinkUrl(url: string): string | null {
  return normalizeUrl(url);
}
