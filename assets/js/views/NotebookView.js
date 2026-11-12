import { sanitizeHTML } from '../utils/sanitize.js';
export class NotebookView {
  constructor() {
    this.book = document.querySelector('#book'); this.editor = document.querySelector('#editor');
    this.toolbar = document.querySelector('#toolbar'); this.statusbar = document.querySelector('#statusbar');
    this.pageStatus = document.querySelector('#pageStatus'); this.flip = document.querySelector('#pageFlip');
    this.canvas = document.querySelector('#drawingCanvas'); this.page = document.querySelector('#page'); this.toast = document.querySelector('#toast'); this.fontSelect = document.querySelector('#fontSelect');
  }
  open() { this.book.dataset.state = 'open'; this.toolbar.hidden = false; this.statusbar.hidden = false; document.querySelector('#coverLabel').textContent = 'Fechar caderno'; }
  close() { this.book.dataset.state = 'closed'; this.toolbar.hidden = true; this.statusbar.hidden = true; document.querySelector('#coverLabel').textContent = 'Abrir caderno'; }
  render(notebook) {
    this.editor.innerHTML = sanitizeHTML(notebook.current.html);
    this.page.classList.toggle('plain-paper', notebook.current.plain);
    document.querySelector('#plainPageBtn').textContent = notebook.current.plain ? '▤ Mostrar linhas' : '▤ Folha sem linhas';
    document.querySelector('#plainPageBtn').setAttribute('aria-pressed', String(notebook.current.plain));
    this.editor.style.fontFamily = notebook.current.font;
    this.fontSelect.value = notebook.current.font;
    this.pageStatus.textContent = `Página ${notebook.index + 1} de ${notebook.pages.length}`;
    document.querySelector('#previousBtn').disabled = notebook.index === 0;
    document.querySelector('#nextBtn').disabled = notebook.index === notebook.pages.length - 1;
  }
  animateFlip(direction = 'next') {
    this.flip.classList.remove('flipping-next', 'flipping-prev');
    void this.flip.offsetWidth;
    this.flip.classList.add(direction === 'previous' ? 'flipping-prev' : 'flipping-next');
    return new Promise(resolve => window.setTimeout(() => { this.flip.classList.remove('flipping-next', 'flipping-prev'); resolve(); }, 580));
  }
  notify(message) { this.toast.textContent = message; this.toast.classList.add('visible'); clearTimeout(this.toastTimer); this.toastTimer = setTimeout(() => this.toast.classList.remove('visible'), 2400); }
}
