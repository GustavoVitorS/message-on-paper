/** Elimina elementos perigosos antes de reintroduzir HTML salvo no contenteditable. */
export function sanitizeHTML(input) {
  const template = document.createElement('template');
  template.innerHTML = input;
  const allowed = new Set(['P', 'DIV', 'BR', 'H1', 'H2', 'H3', 'B', 'STRONG', 'I', 'EM', 'U', 'SPAN', 'MARK', 'UL', 'OL', 'LI']);
  const permittedStyles = new Set(['color', 'background-color']);
  function walk(parent) {
    for (const node of [...parent.childNodes]) {
      if (node.nodeType === Node.COMMENT_NODE) { node.remove(); continue; }
      if (node.nodeType !== Node.ELEMENT_NODE) continue;
      if (!allowed.has(node.tagName)) {
        if (['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'SVG', 'MATH', 'FORM'].includes(node.tagName)) { node.remove(); continue; }
        walk(node); node.replaceWith(...node.childNodes); continue;
      }
      for (const attribute of [...node.attributes]) {
        if (attribute.name === 'style') continue;
        node.removeAttribute(attribute.name);
      }
      if (node.hasAttribute('style')) {
        const css = [...node.style].filter(property => permittedStyles.has(property)).map(property => `${property}:${node.style.getPropertyValue(property)}`).join(';');
        if (css) node.setAttribute('style', css); else node.removeAttribute('style');
      }
      walk(node);
    }
  }
  walk(template.content);
  return template.innerHTML;
}
