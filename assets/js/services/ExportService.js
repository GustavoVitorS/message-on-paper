const pad = n => String(n + 1).padStart(2, '0');
const download = (blob, name) => {
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = name; document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
};
export function exportTXT(editor, index) {
  const text = editor.innerText.replace(/\u00a0/g, ' ').replace(/\r\n?/g, '\n').trimEnd();
  download(new Blob(['\ufeff', text, '\n'], { type: 'text/plain;charset=utf-8' }), `message-on-paper-pagina-${pad(index)}.txt`);
}
/** Exporta as posições reais dos caracteres na página, com as mesmas pautas e traços. */
export function exportPNG(editor, index, { plain = false, strokes = [] } = {}) {
  const page = document.querySelector('#page');
  const bounds = page.getBoundingClientRect();
  const w = bounds.width, h = bounds.height, scale = 3;
  if (!w || !h) return false;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale); canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext('2d'); ctx.scale(scale, scale);
  ctx.fillStyle = plain ? '#ffffff' : '#fbf9fc'; ctx.fillRect(0, 0, w, h);
  if (!plain) {
    ctx.strokeStyle = '#c5cade'; ctx.lineWidth = 1;
    // A pauta CSS começa no pixel 33 e se repete a cada 31 px.
    for (let y = 33.5 - (editor.scrollTop % 31); y < h; y += 31) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
    ctx.strokeStyle = '#df91a4'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(w * .128, 0); ctx.lineTo(w * .128, h); ctx.stroke();
  }
  // Áreas especiais do título cobrem a pauta, como na visualização.
  for (const heading of editor.querySelectorAll('h1')) {
    const r = heading.getBoundingClientRect();
    const x = r.left - bounds.left, y = r.top - bounds.top;
    ctx.fillStyle = plain ? '#ffffff' : '#fbf9fc';
    ctx.fillRect(x, y, r.width, r.height);
    ctx.fillStyle = '#a279f4';
    ctx.fillRect(x + 4, y + r.height - 11, Math.max(0, r.width - 8), 3);
  }
  const iter = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = iter.nextNode())) {
    if (!node.length) continue;
    const style = getComputedStyle(node.parentElement);
    const fontSize = parseFloat(style.fontSize);
    ctx.font = `${style.fontStyle} ${style.fontWeight} ${fontSize}px ${style.fontFamily}`;
    const metrics = ctx.measureText('Mg');
    const ascent = metrics.actualBoundingBoxAscent || fontSize * .8;
    const descent = metrics.actualBoundingBoxDescent || fontSize * .2;
    const range = document.createRange();
    for (let i = 0; i < node.length; i++) {
      if (node.textContent[i] === '\n') continue;
      range.setStart(node, i); range.setEnd(node, i + 1);
      const rect = range.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      const x = rect.left - bounds.left, y = rect.top - bounds.top;
      if (y > h || y + rect.height < 0) continue;
      const background = style.backgroundColor;
      if (background && background !== 'transparent' && background !== 'rgba(0, 0, 0, 0)') {
        ctx.fillStyle = background;
        ctx.fillRect(x, y + 1, rect.width, Math.max(1, rect.height - 2));
      }
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = style.color;
      ctx.fillText(node.textContent[i], x, y + (rect.height + ascent - descent) / 2);
    }
  }
  // Usa coordenadas relativas à folha para que o desenho também apareça no PNG.
  for (const stroke of strokes) {
    if (!stroke.points || stroke.points.length === 0) continue;
    ctx.beginPath(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = stroke.color || '#252131'; ctx.fillStyle = ctx.strokeStyle;
    ctx.lineWidth = stroke.width || 2.5;
    stroke.points.forEach((pt, i) => { const x = pt.x * w, y = pt.y * h; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    if (stroke.points.length === 1) { const p = stroke.points[0]; ctx.beginPath(); ctx.arc(p.x*w,p.y*h,ctx.lineWidth/2,0,Math.PI*2); ctx.fill(); }
    else ctx.stroke();
  }
  canvas.toBlob(blob => download(blob, `message-on-paper-pagina-${pad(index)}${plain ? '-sem-linhas' : ''}.png`), 'image/png');
  return true;
}
