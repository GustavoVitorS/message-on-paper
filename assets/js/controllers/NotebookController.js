import { Notebook } from '../models/Notebook.js';
import { NotebookView } from '../views/NotebookView.js';
import { StorageService } from '../services/StorageService.js';
import { exportPNG, exportTXT } from '../services/ExportService.js';
import { sanitizeHTML } from '../utils/sanitize.js';

export class NotebookController {
  constructor() {
    this.model = new Notebook(StorageService.load() || {});
    this.view = new NotebookView(); this.tool = 'pen'; this.busy = false; this.range = null;
    this.isDrawing = false; this.stroke = null;
    this.drawingHistory = new Map(); this.redoHistory = new Map(); this.pendingDrawingSnapshot = null; this.erasing = false; this.strokeChanged = false;
    this.view.render(this.model);
    this.bind(); this.resizeCanvas(); this.syncRuledLines(); this.updateUndoButton();
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => this.resizeCanvas()).observe(this.view.page);
    else window.addEventListener('resize', () => this.resizeCanvas());
  }
  saveCurrent() {
    this.model.current.html = sanitizeHTML(this.view.editor.innerHTML);
    if (!StorageService.save(this.model)) this.view.notify('Armazenamento indisponível. Exporte suas anotações.');
  }
  open() { this.view.open(); setTimeout(() => this.resizeCanvas(), 200); }
  toggle() { if (this.view.book.dataset.state === 'open') { this.saveCurrent(); this.view.close(); } else this.open(); }
  async switchPage(index, isNew = false) {
    if (this.busy || (!isNew && (index < 0 || index >= this.model.pages.length || index === this.model.index))) return;
    this.busy = true; this.saveCurrent(); this.range = null;
    const animation = this.view.animateFlip(index < this.model.index ? 'previous' : 'next');
    setTimeout(() => {
      if (isNew) this.model.add(); else this.model.go(index);
      this.view.render(this.model); this.syncRuledLines(); this.redraw(); this.updateUndoButton(); StorageService.save(this.model);
    }, 280);
    await animation; this.busy = false;
    if (!this.isDrawing) this.view.editor.focus();
  }
  rememberRange() {
    const sel = window.getSelection();
    if (sel && sel.rangeCount && this.view.editor.contains(sel.anchorNode)) this.range = sel.getRangeAt(0).cloneRange();
  }
  restoreRange() {
    if (!this.range) return false;
    try { const sel = getSelection(); sel.removeAllRanges(); sel.addRange(this.range); return true; } catch { return false; }
  }
  setTool(tool) {
    this.tool = tool;
    this.isDrawing = tool === 'draw' || tool === 'eraser';
    this.view.page.classList.toggle('drawing-mode', this.isDrawing);
    for (const button of document.querySelectorAll('[data-tool]')) {
      const active = button.dataset.tool === tool;
      button.classList.toggle('is-active', active); button.setAttribute('aria-pressed', String(active));
    }
    this.view.page.classList.toggle('erasing-mode', tool === 'eraser');
    const color = document.querySelector('#inkColor');
    if (tool === 'highlight' && color.value === '#242135') color.value = '#ffe477';
    if (tool === 'pen' && color.value === '#ffe477') color.value = '#242135';
    this.view.notify(tool === 'highlight' ? 'Arraste o mouse sobre um texto para destacar.' : tool === 'draw' ? 'Arraste na folha para desenhar. Use Caneta para voltar a digitar.' : tool === 'eraser' ? 'Arraste a borracha sobre os rabiscos para apagá-los, sem alterar o texto.' : 'Caneta ativada. Digite ou selecione texto para colorir.');
  }
  /** Marca automaticamente o texto selecionado pelo mouse — não exige clicar na cor. */
  highlightSelected() {
    const selection = getSelection();
    if (!selection || selection.isCollapsed || !selection.rangeCount) return false;
    const range = selection.getRangeAt(0).cloneRange();
    if (!this.view.editor.contains(range.commonAncestorContainer)) return false;
    const color = document.querySelector('#inkColor').value;
    const walker = document.createTreeWalker(this.view.editor, NodeFilter.SHOW_TEXT);
    const matches = []; let node;
    while ((node = walker.nextNode())) if (node.length && range.intersectsNode(node)) matches.push(node);
    for (const textNode of matches.reverse()) {
      let start = textNode === range.startContainer ? range.startOffset : 0;
      let end = textNode === range.endContainer ? range.endOffset : textNode.length;
      if (end <= start) continue;
      let selected = textNode;
      if (end < selected.length) selected.splitText(end);
      if (start > 0) selected = selected.splitText(start);
      const mark = document.createElement('mark');
      mark.style.backgroundColor = color;
      selected.parentNode.replaceChild(mark, selected); mark.appendChild(selected);
    }
    selection.removeAllRanges(); this.range = null;
    this.saveCurrent(); return true;
  }
  applyColor() {
    if (this.tool === 'draw' || this.tool === 'eraser') return;
    if (this.tool === 'highlight') { if (this.restoreRange()) this.highlightSelected(); return; }
    if (!this.restoreRange()) return;
    this.view.editor.focus();
    document.execCommand('foreColor', false, document.querySelector('#inkColor').value);
    this.saveCurrent();
  }
  syncRuledLines() {
    const lines = this.view.page.querySelector('.page-lines');
    if (lines) lines.style.backgroundPosition = `0px ${3 - this.view.editor.scrollTop}px`;
  }
  resizeCanvas() {
    const canvas = this.view.canvas;
    const rect = this.view.page.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = Math.round(rect.width * dpr); canvas.height = Math.round(rect.height * dpr);
    this.redraw();
  }
  redraw() {
    const canvas = this.view.canvas, ctx = canvas.getContext('2d');
    const rect = this.view.page.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    ctx.setTransform(canvas.width / rect.width, 0, 0, canvas.height / rect.height, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);
    for (const stroke of this.model.current.strokes || []) {
      const points = stroke.points || [];
      if (!points.length) continue;
      ctx.lineWidth = stroke.width || 2.5; ctx.strokeStyle = stroke.color || '#252131';
      ctx.fillStyle = ctx.strokeStyle; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.beginPath(); points.forEach((pt, i) => i ? ctx.lineTo(pt.x * rect.width, pt.y * rect.height) : ctx.moveTo(pt.x * rect.width, pt.y * rect.height));
      if (points.length === 1) { ctx.arc(points[0].x*rect.width,points[0].y*rect.height,ctx.lineWidth/2,0,Math.PI*2);ctx.fill(); }
      else ctx.stroke();
    }
  }
  point(event) {
    const rect = this.view.canvas.getBoundingClientRect();
    return { x: Math.max(0,Math.min(1,(event.clientX - rect.left) / rect.width)), y: Math.max(0,Math.min(1,(event.clientY - rect.top) / rect.height)) };
  }
  // Histórico independente por página. O texto mantém o Ctrl+Z nativo do navegador.
  snapshotStrokes() {
    return JSON.stringify(this.model.current.strokes || []);
  }
  finishDrawingOperation() {
    if (!this.pendingDrawingSnapshot) return;
    if (this.snapshotStrokes() !== this.pendingDrawingSnapshot) {
      const index = this.model.index;
      const stack = this.drawingHistory.get(index) || [];
      stack.push(this.pendingDrawingSnapshot);
      if (stack.length > 60) stack.shift();
      this.drawingHistory.set(index, stack);
      this.redoHistory.set(index, []);
      this.saveCurrent();
    }
    this.pendingDrawingSnapshot = null;
    this.updateUndoButton();
  }
  undoDrawing() {
    if (this.pendingDrawingSnapshot) this.finishDrawingOperation();
    const index = this.model.index, stack = this.drawingHistory.get(index) || [];
    if (!stack.length) { this.view.notify('Nenhum rabisco para desfazer nesta página.'); return; }
    const redo = this.redoHistory.get(index) || [];
    redo.push(this.snapshotStrokes()); this.redoHistory.set(index, redo);
    this.model.current.strokes = JSON.parse(stack.pop());
    this.redraw(); this.saveCurrent(); this.updateUndoButton();
    this.view.notify('Última alteração dos rabiscos desfeita.');
  }
  redoDrawing() {
    const index = this.model.index, redo = this.redoHistory.get(index) || [];
    if (!redo.length) return;
    const stack = this.drawingHistory.get(index) || [];
    stack.push(this.snapshotStrokes()); this.drawingHistory.set(index, stack);
    this.model.current.strokes = JSON.parse(redo.pop());
    this.redraw(); this.saveCurrent(); this.updateUndoButton();
    this.view.notify('Alteração dos rabiscos refeita.');
  }
  updateUndoButton() {
    const button = document.querySelector('#undoDrawingBtn');
    if (button) button.disabled = !(this.drawingHistory.get(this.model.index) || []).length;
  }
  /** Apaga trechos de rabiscos próximos à borracha, preservando o restante do traço.
   *  Pontos dos traços são normalizados para acompanhar o tamanho responsivo da folha. */
  eraseAt(point) {
    const rect = this.view.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const radius = 38; // área ampla de 76 px de diâmetro, em pixels da folha
    const x = point.x * rect.width, y = point.y * rect.height;
    const updated = [];
    let changed = false;
    for (const stroke of this.model.current.strokes) {
      const pts = stroke.points || [];
      if (!pts.length) continue;
      // Amostragem intermediária impede que a borracha atravesse segmentos longos.
      const fragments = [];
      let fragment = [];
      const addSample = (sample) => {
        const px = sample.x * rect.width, py = sample.y * rect.height;
        if (Math.hypot(px - x, py - y) <= radius + (stroke.width || 2.5) / 2) {
          changed = true;
          if (fragment.length) { fragments.push(fragment); fragment = []; }
        } else fragment.push(sample);
      };
      addSample(pts[0]);
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i];
        const dist = Math.hypot((b.x - a.x) * rect.width, (b.y - a.y) * rect.height);
        const steps = Math.max(1, Math.ceil(dist / 3));
        for (let step = 1; step <= steps; step++) {
          const t = step / steps;
          addSample({x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t});
        }
      }
      if (fragment.length) fragments.push(fragment);
      for (const points of fragments) updated.push({...stroke, points});
    }
    if (changed) { this.model.current.strokes = updated; this.redraw(); }
    return changed;
  }
  bind() {
    document.querySelector('#frontCover').addEventListener('click', () => this.open());
    document.querySelector('#coverToggle').addEventListener('click', () => this.toggle());
    document.querySelector('#newPageBtn').addEventListener('click', () => this.switchPage(this.model.pages.length, true));
    document.querySelector('#previousBtn').addEventListener('click', () => this.switchPage(this.model.index - 1));
    document.querySelector('#nextBtn').addEventListener('click', () => this.switchPage(this.model.index + 1));
    document.querySelector('#plainPageBtn').addEventListener('click', () => {
      this.model.current.plain = !this.model.current.plain;
      this.view.page.classList.toggle('plain-paper', this.model.current.plain);
      const btn = document.querySelector('#plainPageBtn');
      btn.textContent = this.model.current.plain ? '▤ Mostrar linhas' : '▤ Folha sem linhas';
      btn.setAttribute('aria-pressed', String(this.model.current.plain));
      this.saveCurrent();
    });
    document.querySelector('#pngBtn').addEventListener('click', () => {
      this.saveCurrent(); exportPNG(this.view.editor, this.model.index, {plain:this.model.current.plain,strokes:this.model.current.strokes});
      this.view.notify('PNG com o conteúdo da página exportado.');
    });
    document.querySelector('#plainPngBtn').addEventListener('click', () => {
      this.saveCurrent(); exportPNG(this.view.editor, this.model.index, {plain:true,strokes:this.model.current.strokes});
      this.view.notify('PNG sem linhas exportado.');
    });
    document.querySelector('#txtBtn').addEventListener('click', () => {
      this.saveCurrent(); exportTXT(this.view.editor, this.model.index); this.view.notify('TXT exportado.');
    });
    for (const button of document.querySelectorAll('[data-tool]')) button.addEventListener('click', () => this.setTool(button.dataset.tool));
    document.querySelector('#undoDrawingBtn').addEventListener('click', () => this.undoDrawing());

    document.querySelector('#inkColor').addEventListener('input', () => this.applyColor());
    this.view.fontSelect.addEventListener('change', event => {
      this.model.current.font = event.target.value;
      this.view.editor.style.fontFamily = event.target.value; this.saveCurrent();
    });
    // Evita que Enter produza <div>/<p> com métricas próprias no contenteditable.
    // O comando insere uma quebra simples preservando marcações e undo nativo.
    this.view.editor.addEventListener('beforeinput', event => {
      if (event.inputType !== 'insertParagraph' || event.isComposing) return;
      // Em títulos, deixe o navegador criar o parágrafo seguinte,
      // evitando que o usuário fique preso no formato de título.
      const selection = window.getSelection();
      const anchor = selection && selection.anchorNode;
      const parent = anchor && (anchor.nodeType === Node.ELEMENT_NODE ? anchor : anchor.parentElement);
      if (parent && parent.closest('h1,h2,h3')) return;
      event.preventDefault();
      document.execCommand('insertLineBreak', false);
    });
    // Uma área com rolagem própria exige que a pauta role pelo mesmo deslocamento.
    this.view.editor.addEventListener('scroll', () => this.syncRuledLines());
    this.view.editor.addEventListener('input', () => { this.syncRuledLines(); clearTimeout(this.saveTimer); this.saveTimer = setTimeout(() => this.saveCurrent(), 250); });
    this.view.editor.addEventListener('keyup', () => this.rememberRange());
    this.view.editor.addEventListener('mouseup', () => {
      if (this.tool === 'highlight') { this.highlightSelected(); } else this.rememberRange();
    });
    this.view.editor.addEventListener('touchend', () => {
      if (this.tool === 'highlight') setTimeout(() => this.highlightSelected(), 120);
    });
    this.view.editor.addEventListener('paste', event => {
      event.preventDefault(); document.execCommand('insertText', false, event.clipboardData.getData('text/plain'));
    });
    const canvas = this.view.canvas;
    canvas.addEventListener('pointerdown', event => {
      if (!this.isDrawing) return;
      event.preventDefault(); canvas.setPointerCapture(event.pointerId);
      this.pendingDrawingSnapshot = this.snapshotStrokes();
      if (this.tool === 'eraser') {
        this.erasing = true;
        this.eraseAt(this.point(event));
      } else {
        this.stroke = {color:document.querySelector('#inkColor').value,width:2.5,points:[this.point(event)]};
        this.model.current.strokes.push(this.stroke); this.redraw();
      }
    });
    canvas.addEventListener('pointermove', event => {
      if (this.erasing) { this.eraseAt(this.point(event)); return; }
      if (!this.stroke) return;
      this.stroke.points.push(this.point(event)); this.redraw();
    });
    const finish = () => {
      if (this.stroke || this.erasing) {
        this.stroke = null; this.erasing = false;
        this.finishDrawingOperation();
      }
    };
    canvas.addEventListener('pointerup', finish); canvas.addEventListener('pointercancel', finish);
    window.addEventListener('beforeunload', () => this.saveCurrent());
    document.addEventListener('keydown', event => {
      const modifier = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      // Nunca rouba Ctrl+Z do campo de texto enquanto a caneta/marca-texto está ativa.
      const drawingContext = this.isDrawing || !this.view.editor.contains(document.activeElement);
      if (modifier && !event.altKey && drawingContext && key === 'z') {
        event.preventDefault();
        if (event.shiftKey) this.redoDrawing(); else this.undoDrawing();
        return;
      }
      if (modifier && !event.altKey && drawingContext && key === 'y') {
        event.preventDefault(); this.redoDrawing(); return;
      }
      if (modifier && key === 's') {
        event.preventDefault(); this.saveCurrent(); this.view.notify('Anotações salvas.');
      }
    });
  }
}
