/**
 * Notebook domain model.
 * Keeps page data and navigation independent from DOM rendering.
 */
export class Notebook {
  constructor(data = {}) {
    const hasSavedPages = Array.isArray(data.pages) && data.pages.length > 0;

    this.pages = hasSavedPages
      ? data.pages.map(page => ({
          html: String(page.html ?? ''),
          font: page.font || 'Georgia',
          plain: Boolean(page.plain),
          strokes: Array.isArray(page.strokes) ? page.strokes : [],
        }))
      : [{
          html: '<h1>Minhas anotações</h1><p>Este é o meu caderno digital.</p><p>Posso escrever, <mark>destacar</mark> e exportar.</p>',
          font: 'Georgia',
          plain: false,
          strokes: [],
        }];

    this.index = Math.min(
      Math.max(Number(data.index) || 0, 0),
      this.pages.length - 1,
    );
  }

  get current() {
    return this.pages[this.index];
  }

  add() {
    this.pages.push({
      html: '',
      font: this.current.font,
      plain: this.current.plain,
      strokes: [],
    });
    this.index = this.pages.length - 1;
  }

  go(index) {
    if (index < 0 || index >= this.pages.length) return false;
    this.index = index;
    return true;
  }

  serialize() {
    return { pages: this.pages, index: this.index };
  }
}
