/* ============================================================
   DOCX 保真解析器（第 0 期原型）
   针对"手动直接格式"类档案文档：字号/对齐/颜色/表格底纹全保留
   依赖：浏览器原生 DecompressionStream（Edge/Chrome 80+）
   输出：白名单标签 HTML（p/h2/h3/h4/table/tr/td/span/strong/em/u/img/br/hr）
   ============================================================ */
(function () {
  'use strict';

  /* ---------------- 极简 ZIP 读取（中央目录 + deflate-raw） ---------------- */
  async function unzip(buf) {
    const dv = new DataView(buf);
    const u8 = new Uint8Array(buf);
    // 从尾部找 EOCD 签名 0x06054b50
    let eocd = -1;
    for (let i = u8.length - 22; i >= 0; i--) {
      if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('不是有效的 DOCX（ZIP 目录损坏）');
    const count = dv.getUint16(eocd + 10, true);
    let off = dv.getUint32(eocd + 16, true);
    const files = {};
    for (let n = 0; n < count; n++) {
      if (dv.getUint32(off, true) !== 0x02014b50) break;
      const method = dv.getUint16(off + 10, true);
      const compSize = dv.getUint32(off + 20, true);
      const nameLen = dv.getUint16(off + 28, true);
      const extraLen = dv.getUint16(off + 30, true);
      const commentLen = dv.getUint16(off + 32, true);
      const localOff = dv.getUint32(off + 42, true);
      const name = new TextDecoder().decode(u8.subarray(off + 46, off + 46 + nameLen));
      // 本地头：数据偏移 = localOff + 30 + 本地名长 + 本地扩展长
      const lNameLen = dv.getUint16(localOff + 26, true);
      const lExtraLen = dv.getUint16(localOff + 28, true);
      const dataStart = localOff + 30 + lNameLen + lExtraLen;
      const raw = u8.subarray(dataStart, dataStart + compSize);
      files[name] = { method, raw };
      off += 46 + nameLen + extraLen + commentLen;
    }
    // 解压
    const out = {};
    for (const name of Object.keys(files)) {
      const f = files[name];
      if (f.method === 0) { out[name] = f.raw; continue; }
      if (f.method === 8) {
        if (!('DecompressionStream' in window)) throw new Error('当前浏览器不支持解压（需 Edge/Chrome 80+）');
        const stream = new Blob([f.raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
        out[name] = new Uint8Array(await new Response(stream).arrayBuffer());
      }
    }
    return out;
  }

  /* ---------------- XML 工具 ---------------- */
  function parseXml(bytes) {
    const text = new TextDecoder('utf-8').decode(bytes);
    const doc = new DOMParser().parseFromString(text, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) throw new Error('XML 解析失败');
    return doc;
  }
  // 仅取直接子节点中第一个指定标签（避免抓到嵌套同名节点）
  function child(el, tag) {
    for (let i = 0; i < el.childNodes.length; i++) {
      const c = el.childNodes[i];
      if (c.nodeType === 1 && c.localName === tag.split(':')[1]) return c;
    }
    return null;
  }
  function children(el, tag) {
    const out = [];
    const local = tag.split(':')[1];
    for (let i = 0; i < el.childNodes.length; i++) {
      const c = el.childNodes[i];
      if (c.nodeType === 1 && c.localName === local) out.push(c);
    }
    return out;
  }
  function attr(el, name) { return el ? el.getAttribute('w:' + name) : null; }
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ---------------- 颜色映射（白底文档 → 暗色站点） ---------------- */
  // 近黑色 → 站点默认正文色（不输出样式）；灰 → dx-muted；羊皮纸色 → dx-gold
  const COLOR_MAP = {
    '555555': 'dx-muted', '666666': 'dx-muted', '777777': 'dx-muted', '808080': 'dx-muted',
    'B3A78F': 'dx-gold', 'F3EDDF': 'dx-gold', 'C9A227': 'dx-gold'
  };
  const NEAR_BLACK = /^(000000|auto|[0-3][0-9a-f]{5})$/i;

  function mapColor(hex, warnings) {
    if (!hex) return null;
    const h = hex.toUpperCase();
    if (NEAR_BLACK.test(h)) return null;
    if (COLOR_MAP[h]) return { cls: COLOR_MAP[h] };
    // 未知颜色：提亮后内联保留（暗色背景可读性），并记警告
    warnings.push('未映射颜色 #' + h + '，已内联保留');
    return { inline: '#' + h };
  }

  /* ---------------- 运行块（w:r） ---------------- */
  function runHtml(r, ctx) {
    const rPr = child(r, 'w:rPr');
    let bold = false, italic = false, underline = false;
    let szPt = 0, color = null, fontCls = '';
    if (rPr) {
      const sz = child(rPr, 'w:sz');
      if (sz) szPt = (parseInt(attr(sz, 'val'), 10) || 0) / 2;
      bold = !!child(rPr, 'w:b');
      italic = !!child(rPr, 'w:i');
      underline = !!child(rPr, 'w:u');
      const colorEl = child(rPr, 'w:color');
      if (colorEl) color = mapColor(attr(colorEl, 'val'), ctx.warnings);
      const fonts = child(rPr, 'w:rFonts');
      if (fonts) {
        const ea = fonts.getAttribute('w:eastAsia') || '';
        if (/黑体|微软雅黑|雅黑/.test(ea)) fontCls = 'dx-f-head';
        else if (/楷体|仿宋/.test(ea)) fontCls = 'dx-f-kai';
      }
    }
    if (szPt > ctx.maxSz) ctx.maxSz = szPt;

    // 文本/制表/换行/图片
    let inner = '';
    for (let i = 0; i < r.childNodes.length; i++) {
      const c = r.childNodes[i];
      if (c.nodeType !== 1) continue;
      const ln = c.localName;
      if (ln === 't') inner += esc(c.textContent);
      else if (ln === 'tab') inner += '&emsp;';
      else if (ln === 'br' || ln === 'cr') inner += '<br>';
      else if (ln === 'drawing') {
        const img = drawingHtml(c, ctx);
        if (img) inner += img;
      }
    }
    if (!inner) return '';
    if (bold) inner = '<strong>' + inner + '</strong>';
    if (italic) inner = '<em>' + inner + '</em>';
    if (underline) inner = '<u>' + inner + '</u>';
    // 包装 span：颜色/字体/相对字号（基准 9.5pt = 1em）
    const styles = [];
    if (szPt && szPt < 20) { // 标题级字号由段落 h 标签承担
      const em = Math.max(0.72, Math.min(1.45, szPt / 9.5));
      if (Math.abs(em - 1) > 0.06) styles.push('font-size:' + em.toFixed(2) + 'em');
    }
    if (color && color.inline) styles.push('color:' + color.inline);
    const cls = [fontCls, color && color.cls].filter(Boolean).join(' ');
    if (cls || styles.length) {
      inner = '<span' + (cls ? ' class="' + cls + '"' : '') +
        (styles.length ? ' style="' + styles.join(';') + '"' : '') + '>' + inner + '</span>';
    }
    return inner;
  }

  /* ---------------- 图片：占位 + 后处理压缩（>150KB 重编码 JPEG q82，限宽1600） ---------------- */
  function b64(bytes) {
    let bin = '';
    for (let i = 0; i < bytes.length; i += 8192) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
    }
    return btoa(bin);
  }

  async function compressImage(bytes) {
    if (bytes.length < 150 * 1024 || !('createImageBitmap' in window)) return null;
    try {
      const bmp = await createImageBitmap(new Blob([bytes]));
      const scale = Math.min(1, 1600 / bmp.width);
      const w = Math.max(1, Math.round(bmp.width * scale));
      const h = Math.max(1, Math.round(bmp.height * scale));
      const cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      const g = cv.getContext('2d');
      g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); // JPEG 无透明通道，铺白底
      g.drawImage(bmp, 0, 0, w, h);
      if (bmp.close) bmp.close();
      const url = cv.toDataURL('image/jpeg', 0.82);
      // base64 约 4/3 膨胀，只在确实变小时采用
      return url.length < bytes.length * 1.3 ? url : null;
    } catch (_) { return null; }
  }

  function drawingHtml(d, ctx) {
    // 找 a:blip 的 r:embed
    const blips = d.getElementsByTagNameNS('*', 'blip');
    if (!blips.length) return '';
    const rid = blips[0].getAttribute('r:embed') || blips[0].getAttribute('r:link');
    if (!rid || !ctx.rels[rid]) { ctx.warnings.push('图片关系缺失 ' + rid); return ''; }
    const target = 'word/' + ctx.rels[rid].replace(/^\//, '');
    const bytes = ctx.files[target];
    if (!bytes) { ctx.warnings.push('图片文件缺失 ' + target); return ''; }
    const ext = (target.split('.').pop() || 'png').toLowerCase();
    const mime = ext === 'jpg' ? 'image/jpeg' : 'image/' + ext;
    const idx = ctx.images.length;
    ctx.images.push({ bytes, mime });
    return '<img class="dx-img" data-dximg="' + idx + '" alt="文档插图">';
  }

  /* ---------------- 段落（w:p） ---------------- */
  function paraHtml(p, ctx, inTable) {
    const pPr = child(p, 'w:pPr');
    let align = '', shdFill = '';
    if (pPr) {
      const jc = child(pPr, 'w:jc');
      const jv = attr(jc, 'val');
      if (jv === 'center') align = 'center';
      else if (jv === 'right') align = 'right';
      else if (jv === 'both') align = 'justify';
      const shd = child(pPr, 'w:shd');
      if (shd) shdFill = attr(shd, 'fill') || '';
    }
    const rCtx = { warnings: ctx.warnings, rels: ctx.rels, files: ctx.files, stats: ctx.stats, images: ctx.images, maxSz: 0 };
    let inner = '';
    children(p, 'w:r').forEach(r => { inner += runHtml(r, rCtx); });

    if (!inner.trim()) {
      return inTable ? '' : '<p class="dx-sp"><br></p>';
    }
    ctx.stats.paras++;
    // 标题分级：按段内最大字号
    const sz = rCtx.maxSz;
    let tag = 'p';
    if (!inTable) {
      if (sz >= 20) tag = 'h2';
      else if (sz >= 13) tag = 'h3';
      else if (sz >= 11) tag = 'h4';
    }
    const attrs = [];
    if (tag === 'h2') attrs.push('class="dx-title"');
    else if (tag === 'h3') attrs.push('class="dx-h3"');
    else if (tag === 'h4') attrs.push('class="dx-h4"');
    if (/^(F2F2F2|EDEDED|E5E5E5)$/i.test(shdFill)) attrs.push('class="dx-pshd"');
    const st = [];
    if (align) st.push('text-align:' + align);
    if (st.length) attrs.push('style="' + st.join(';') + '"');
    return '<' + tag + (attrs.length ? ' ' + attrs.join(' ') : '') + '>' + inner + '</' + tag + '>';
  }

  /* ---------------- 表格（w:tbl） ---------------- */
  function tableHtml(tbl, ctx) {
    // 两遍：先建矩阵（含 vMerge/colspan 元数据），再发射 HTML
    const rows = children(tbl, 'w:tr');
    const matrix = [];
    rows.forEach((tr, ri) => {
      const row = [];
      children(tr, 'w:tc').forEach(tc => {
        const tcPr = child(tc, 'w:tcPr');
        let colspan = 1, vmerge = '', shd = '';
        if (tcPr) {
          const gs = child(tcPr, 'w:gridSpan');
          if (gs) colspan = parseInt(attr(gs, 'val'), 10) || 1;
          const vm = child(tcPr, 'w:vMerge');
          if (vm) vmerge = attr(vm, 'val') || 'continue';
          const sd = child(tcPr, 'w:shd');
          if (sd) shd = attr(sd, 'fill') || '';
        }
        let inner = '';
        children(tc, 'w:p').forEach(p => { inner += paraHtml(p, ctx, true) || '<br>'; });
        children(tc, 'w:tbl').forEach(nt => { inner += tableHtml(nt, ctx); }); // 嵌套表
        row.push({ inner, colspan, vmerge, shd });
      });
      matrix.push(row);
    });
    // vMerge continue → 给同列上方最近的非 continue 单元格加 rowspan，并丢弃自身
    const colspanAt = (ri, ci) => matrix[ri][ci] ? matrix[ri][ci].colspan : 1;
    for (let ri = 0; ri < matrix.length; ri++) {
      let colIdx = 0;
      for (let ci = 0; ci < matrix[ri].length; ci++) {
        const cell = matrix[ri][ci];
        cell_col: {
          if (cell.vmerge === 'continue') {
            // 向上找锚点
            for (let up = ri - 1; up >= 0; up--) {
              // 计算 up 行中落在同一列的单元格
              let uc = 0, found = null;
              for (let uci = 0; uci < matrix[up].length; uci++) {
                if (uc === colIdx) { found = matrix[up][uci]; break; }
                uc += matrix[up][uci].colspan;
              }
              if (found && !found._skip) { found._rowspan = (found._rowspan || 1) + 1; break cell_col; }
            }
          }
        }
        if (cell.vmerge === 'continue') cell._skip = true;
        colIdx += cell.colspan;
      }
    }
    let html = '<table class="dossier-table dx-table">';
    matrix.forEach(row => {
      html += '<tr>';
      row.forEach(cell => {
        if (cell._skip) return;
        const attrs = [];
        if (cell.colspan > 1) attrs.push('colspan="' + cell.colspan + '"');
        if (cell._rowspan > 1) attrs.push('rowspan="' + cell._rowspan + '"');
        if (/^(F2F2F2|EDEDED|E5E5E5)$/i.test(cell.shd)) attrs.push('class="dx-shade"');
        html += '<td' + (attrs.length ? ' ' + attrs.join(' ') : '') + '>' + (cell.inner || '') + '</td>';
      });
      html += '</tr>';
    });
    html += '</table>';
    ctx.stats.tables++;
    return html;
  }

  /* ---------------- 主入口 ---------------- */
  async function parse(arrayBuffer) {
    const files = await unzip(arrayBuffer);
    if (!files['word/document.xml']) throw new Error('DOCX 结构不完整（缺 word/document.xml）');
    const warnings = [];
    const stats = { paras: 0, tables: 0, images: 0, chars: 0 };

    // 关系表
    const rels = {};
    if (files['word/_rels/document.xml.rels']) {
      const relDoc = parseXml(files['word/_rels/document.xml.rels']);
      const rs = relDoc.getElementsByTagNameNS('*', 'Relationship');
      for (let i = 0; i < rs.length; i++) {
        rels[rs[i].getAttribute('Id')] = rs[i].getAttribute('Target');
      }
    }

    const doc = parseXml(files['word/document.xml']);
    const body = doc.getElementsByTagNameNS('*', 'body')[0];
    if (!body) throw new Error('文档正文为空');

    const ctx = { warnings, stats, rels, files, images: [] };
    let html = '';
    for (let i = 0; i < body.childNodes.length; i++) {
      const el = body.childNodes[i];
      if (el.nodeType !== 1) continue;
      if (el.localName === 'p') html += paraHtml(el, ctx, false);
      else if (el.localName === 'tbl') html += tableHtml(el, ctx);
      // sectPr / bookmark 等跳过
    }
    // 图片后处理：压缩大图并回填占位符
    stats.images = ctx.images.length;
    for (let k = 0; k < ctx.images.length; k++) {
      const im = ctx.images[k];
      let src = await compressImage(im.bytes);
      if (src) { stats.compressed = (stats.compressed || 0) + 1; }
      else src = 'data:' + im.mime + ';base64,' + b64(im.bytes);
      html = html.replace('<img class="dx-img" data-dximg="' + k + '"', '<img class="dx-img" src="' + src + '"');
    }
    stats.chars = html.replace(/<[^>]+>/g, '').length;
    if (files['word/header1.xml'] || files['word/footer1.xml']) {
      warnings.push('页眉/页脚已忽略（站点档案不使用页眉页脚）');
    }
    return { html, stats, warnings: warnings.slice(0, 30) };
  }

  /* ---------------- 路由探测：统计 Word 样式使用量 ----------------
     pStyle ≥3 → 标准样式文档（mammoth 更合适）；否则手动直接格式（本解析器） */
  async function inspect(arrayBuffer) {
    const files = await unzip(arrayBuffer);
    if (!files['word/document.xml']) throw new Error('DOCX 结构不完整');
    const text = new TextDecoder('utf-8').decode(files['word/document.xml']);
    const m = text.match(/w:pStyle /g);
    return { pStyleCount: m ? m.length : 0 };
  }

  window.DOCXParser = { parse, inspect };
})();
