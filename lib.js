/* PDF + ZIP builders. No DOM access, so they can be tested in Node. */
function latin1(s) {
  const a = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i) & 255;
  return a;
}
function concatBytes(chunks) {
  let n = 0;
  for (const c of chunks) n += c.length;
  const o = new Uint8Array(n);
  let p = 0;
  for (const c of chunks) { o.set(c, p); p += c.length; }
  return o;
}

/* ---------- ZIP (store, no compression) ---------- */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function zipStore(files, when) {
  const d = when ? new Date(when) : new Date();
  const dosTime = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  const dosDate = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  const parts = [];
  const central = [];
  let offset = 0;
  const te = new TextEncoder();
  for (const f of files) {
    const name = te.encode(f.name);
    const crc = crc32(f.data);
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true);
    lh.setUint16(4, 20, true);
    lh.setUint16(6, 0x0800, true);
    lh.setUint16(8, 0, true);
    lh.setUint16(10, dosTime, true);
    lh.setUint16(12, dosDate, true);
    lh.setUint32(14, crc, true);
    lh.setUint32(18, f.data.length, true);
    lh.setUint32(22, f.data.length, true);
    lh.setUint16(26, name.length, true);
    lh.setUint16(28, 0, true);
    parts.push(new Uint8Array(lh.buffer), name, f.data);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true);
    ch.setUint16(4, 20, true);
    ch.setUint16(6, 20, true);
    ch.setUint16(8, 0x0800, true);
    ch.setUint16(10, 0, true);
    ch.setUint16(12, dosTime, true);
    ch.setUint16(14, dosDate, true);
    ch.setUint32(16, crc, true);
    ch.setUint32(20, f.data.length, true);
    ch.setUint32(24, f.data.length, true);
    ch.setUint16(28, name.length, true);
    ch.setUint32(42, offset, true);
    central.push(new Uint8Array(ch.buffer), name);
    offset += 30 + name.length + f.data.length;
  }
  const cdBytes = concatBytes(central);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, cdBytes.length, true);
  end.setUint32(16, offset, true);
  return concatBytes([...parts, cdBytes, new Uint8Array(end.buffer)]);
}

/* ---------- Helvetica metrics (ASCII 32..126, per 1000 em) ---------- */
const HW = '278 278 355 556 556 889 667 191 333 333 389 584 278 333 278 278 556 556 556 556 556 556 556 556 556 556 278 278 584 584 584 556 1015 667 667 722 722 667 611 778 722 278 500 667 556 833 722 778 667 778 722 667 611 722 667 944 667 667 611 278 278 278 469 556 333 556 556 500 556 556 278 556 556 222 222 500 222 833 556 556 556 556 333 500 278 556 500 722 500 500 500 334 260 334 584'.split(' ').map(Number);
const HB = '278 333 474 556 556 889 722 238 333 333 389 584 278 333 278 278 556 556 556 556 556 556 556 556 556 556 333 333 584 584 584 611 975 722 722 722 722 667 611 778 722 278 556 722 611 833 722 778 667 778 722 667 611 722 667 944 667 667 611 333 278 333 584 556 333 556 611 556 611 556 333 611 611 278 278 556 278 889 611 611 611 611 389 556 333 611 556 778 556 556 500 389 280 389 584'.split(' ').map(Number);
function strW(s, size, bold) {
  const t = bold ? HB : HW;
  let w = 0;
  s = String(s);
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    w += c >= 32 && c <= 126 ? t[c - 32] : 556;
  }
  return (w * size) / 1000;
}
function wrapText(s, size, bold, maxW) {
  const words = String(s).split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? cur + ' ' + w : w;
    if (strW(test, size, bold) <= maxW || !cur) cur = test;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [''];
}

/* ---------- PDF (US Letter) ---------- */
function pdfEsc(s) {
  return String(s).replace(/[^\x20-\x7e]/g, '?').replace(/[\\()]/g, '\\$&');
}
function fmt(n) { return (Math.round(n * 100) / 100).toString(); }

/*
 opts = {
   utn, utnLabel, formNo, title1, title2, types:[...], logo:{bytes,w,h}|null,
   stages:[{k,label}], segments:[{label,type,photos:{pre,during,post}}],
   page1: { sections:[{title,rows:[{t,on,r}]}], repairType, cms, remarks:[...],
            initials:{c,q,s}, shlPresent, prodName, prodDesig }
 }
 photo = { bytes:Uint8Array(JPEG), w, h } or null
*/
function buildPdf(opts) {
  const W = 612, H = 792, M = 36, CW = W - 2 * M;
  const AMBER = '1 0.753 0', BLACK = '0 0 0', GREY = '0.35 0.35 0.35';
  const segs = opts.segments.length ? opts.segments : [{ label: '-', type: '', photos: {} }];
  const objs = [];
  const add = (chunks) => {
    const id = objs.length + 1;
    objs.push(concatBytes([latin1(id + ' 0 obj\n'), ...chunks, latin1('\nendobj\n')]));
    return id;
  };
  for (let i = 0; i < 5; i++) objs.push(null); // 1 catalog, 2 pages, 3 F1, 4 F2, 5 info
  const kids = [];
  const addImage = (ph) => add([
    latin1(`<< /Type /XObject /Subtype /Image /Width ${ph.w} /Height ${ph.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${ph.bytes.length} >>\nstream\n`),
    ph.bytes,
    latin1('\nendstream'),
  ]);
  const logoId = opts.logo && opts.logo.bytes ? addImage(opts.logo) : null;

  function newPage() {
    const ops = [];
    const res = [];
    const Y = (t) => H - t;
    const P = {
      ops, res,
      rectFill: (x, top, w, h, rgb) => ops.push(`${rgb} rg ${fmt(x)} ${fmt(Y(top + h))} ${fmt(w)} ${fmt(h)} re f`),
      rect: (x, top, w, h, lw, rgb) => ops.push(`${lw || 0.6} w ${rgb || BLACK} RG ${fmt(x)} ${fmt(Y(top + h))} ${fmt(w)} ${fmt(h)} re S`),
      line: (x1, t1, x2, t2, lw, rgb) => ops.push(`${lw || 0.6} w ${rgb || BLACK} RG ${fmt(x1)} ${fmt(Y(t1))} m ${fmt(x2)} ${fmt(Y(t2))} l S`),
      text: (s, x, base, size, bold, rgb) => ops.push(`BT ${rgb || BLACK} rg /${bold ? 'F2' : 'F1'} ${size} Tf ${fmt(x)} ${fmt(Y(base))} Td (${pdfEsc(s)}) Tj ET`),
      ctext: (s, x, w, base, size, bold, rgb) => P.text(s, x + (w - strW(s, size, bold)) / 2, base, size, bold, rgb),
      rtext: (s, xr, base, size, bold, rgb) => P.text(s, xr - strW(s, size, bold), base, size, bold, rgb),
      check: (cx, cy, s) => { // box centred at cx, cy (top-origin) with a tick
        P.rect(cx - s / 2, cy - s / 2, s, s, 0.7);
      },
      tick: (cx, cy, s) => {
        ops.push(`1.1 w ${BLACK} RG ${fmt(cx - s * 0.3)} ${fmt(Y(cy))} m ${fmt(cx - s * 0.08)} ${fmt(Y(cy + s * 0.28))} l ${fmt(cx + s * 0.34)} ${fmt(Y(cy - s * 0.3))} l S`);
      },
      image: (ph, x, top, w, h) => {
        const id = ph.__id || (ph.__id = addImage(ph));
        const name = 'Im' + (res.length + 1);
        res.push(`/${name} ${id} 0 R`);
        ops.push(`q ${fmt(w)} 0 0 ${fmt(h)} ${fmt(x)} ${fmt(Y(top + h))} cm /${name} Do Q`);
      },
      sigImage: (ph, x, top, w, h) => {
        const sc = Math.min(w / ph.w, h / ph.h);
        const dw = ph.w * sc, dh = ph.h * sc;
        P.image(ph, x + (w - dw) / 2, top + (h - dh), dw, dh);
      },
      logo: (x, top, w, h) => {
        if (!logoId) return;
        const sc = Math.min((w - 8) / opts.logo.w, (h - 6) / opts.logo.h);
        const dw = opts.logo.w * sc, dh = opts.logo.h * sc;
        const name = 'Lg';
        res.push(`/${name} ${logoId} 0 R`);
        ops.push(`q ${fmt(dw)} 0 0 ${fmt(dh)} ${fmt(x + (w - dw) / 2)} ${fmt(Y(top + (h - dh) / 2 + dh))} cm /${name} Do Q`);
      },
    };
    return P;
  }
  function finishPage(P) {
    const stream = latin1(P.ops.join('\n'));
    const contentId = add([latin1(`<< /Length ${stream.length} >>\nstream\n`), stream, latin1('\nendstream')]);
    const pageId = add([
      latin1(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Contents ${contentId} 0 R ` +
          `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> /XObject << ${P.res.join(' ')} >> >> >>`
      ),
    ]);
    kids.push(pageId);
  }

  /* header block shared by every page. Returns the top of the next block. */
  function header(P, title, formNo, utnCell, segCell, ticked) {
    const top = 30, hh = 34;
    P.rect(M, top, CW, hh, 1);
    P.line(M + 120, top, M + 120, top + hh, 1);
    P.line(M + 420, top, M + 420, top + hh, 1);
    P.rectFill(M + 120.5, top + 0.5, 299, hh - 1, AMBER);
    P.logo(M, top, 120, hh);
    const tl = wrapText(title, 10.5, true, 285);
    const ty = top + hh / 2 - ((tl.length - 1) * 6) / 2 + 3.5;
    tl.forEach((l, i) => P.ctext(l, M + 120, 299, ty + i * 12, 10.5, true));
    const fsz = Math.min(7.5, (112 / strW(formNo, 7.5, true)) * 7.5);
    P.ctext(formNo, M + 420, 120, top + hh / 2 + 2.6, fsz, true);

    const rt = top + hh + 4, rh = 26;
    P.rect(M, rt, CW, rh, 1);
    let x = M;
    const cellA = 130;
    P.ctext('RING SERIAL NUMBER (UTN)', x, cellA, rt + rh / 2 + 3, 7.5, true);
    x += cellA; P.line(x, rt, x, rt + rh, 1);
    const cellB = segCell ? 70 : 150;
    P.ctext(utnCell, x, cellB, rt + rh / 2 + 4, 11, true);
    x += cellB; P.line(x, rt, x, rt + rh, 1);
    if (segCell) {
      P.ctext('SEGMENT', x, 60, rt + 10, 6.5, true, GREY);
      P.ctext(segCell, x, 60, rt + 21, 11, true);
      x += 60; P.line(x, rt, x, rt + rh, 1);
    }
    // reinforcement boxes
    const rw = M + CW - x;
    P.text('REINFORCEMENT', x + 6, rt + rh / 2 + 3, 7.5, true);
    let bx = x + 6 + strW('REINFORCEMENT', 7.5, true) + 8;
    const items = opts.types;
    const step = (M + CW - 4 - bx) / items.length;
    items.forEach((t) => {
      P.text(t, bx, rt + rh / 2 + 3, 7.5, true);
      const cx = bx + strW(t, 7.5, true) + 7;
      P.check(cx, rt + rh / 2, 9);
      if (ticked.indexOf(t) >= 0) P.tick(cx, rt + rh / 2, 9);
      bx += step;
    });
    return rt + rh + 6;
  }

  /* ---------- page 1 : the checklist ---------- */
  if (opts.page1) {
    const p1 = opts.page1, P = newPage();
    const ini = p1.initials;
    const usedTypes = opts.types.filter((t) => segs.some((s) => s.type === t));
    let y = header(P, opts.title1, opts.formNo, opts.utnLabel, null, usedTypes);

    const cL = M, wL = 190, cK = M + 190, wK = 18, cR = M + 208, wR = 176;
    const cC = M + 384, cQ = M + 436, cS = M + 488, wI = 52;
    const FS = 6.8, LH = 7.6;

    p1.sections.forEach((sec) => {
      // section header row
      const hh = 13;
      P.rectFill(M + 0.3, y + 0.3, 208 - 0.6, hh - 0.6, AMBER);
      P.rect(M, y, CW, hh, 0.8);
      [208, 384, 436, 488].forEach((dx) => P.line(M + dx, y, M + dx, y + hh, 0.8));
      P.ctext(sec.title, M, 208, y + 9.2, 7.5, true);
      P.ctext('REMARKS', cR - 0, 176, y + 9.2, 7, true);
      P.ctext('FGJV CONST', cC, wI, y + 9.2, 6.2, true);
      P.ctext('FGJV QUA', cQ, wI, y + 9.2, 6.2, true);
      P.ctext('SHL', cS, wI, y + 9.2, 6.2, true);
      y += hh;
      sec.rows.forEach((r) => {
        const ll = wrapText(r.t, FS, false, wL - 6);
        const rl = wrapText(r.r || '', FS, false, wR - 6);
        const n = Math.max(ll.length, rl.length, 1);
        const h = n === 1 ? 13.5 : 5 + n * LH;
        P.rect(M, y, CW, h, 0.5, '0.4 0.4 0.4');
        [190, 208, 384, 436, 488].forEach((dx) => P.line(M + dx, y, M + dx, y + h, 0.5, '0.4 0.4 0.4'));
        const first = n === 1 ? y + h / 2 + 2.4 : y + 3 + LH - 1.2;
        ll.forEach((l, i) => P.text(l, cL + 3, first + i * LH, FS, false));
        rl.forEach((l, i) => P.text(l, cR + 3, first + i * LH, FS, false));
        P.check(cK + 9, y + h / 2, 8);
        if (r.on) P.tick(cK + 9, y + h / 2, 8);
        const iy = y + h / 2 + 2.4;
        P.ctext(ini.c || '', cC, wI, iy, 7, false);
        P.ctext(ini.q || '', cQ, wI, iy, 7, false);
        P.ctext(ini.s || '', cS, wI, iy, 6.4, false);
        y += h;
      });
      // after-section extras
      if (sec.after === 'repairType') {
        const h = 18;
        P.rect(M, y, CW, h, 0.8);
        [84, 264, 364].forEach((dx) => P.line(M + dx, y, M + dx, y + h, 0.8));
        P.ctext('TYPE OF REPAIR', M, 84, y + h / 2 + 2.6, 7.2, true);
        P.ctext(p1.repairType, M + 84, 180, y + h / 2 + 2.6, 7.2, false);
        P.ctext('REFERENCE CMS', M + 264, 100, y + h / 2 + 2.6, 7.2, true);
        P.ctext(p1.cms, M + 364, CW - 364, y + h / 2 + 2.6, 7.2, false);
        y += h + 4;
        // readiness statement
        P.text('The above item(s) have been checked and is/are ready for repairs:', M, y + 10, 7.2, false);
        if (p1.signature) P.sigImage(p1.signature, M + 300, y - 2, 200, 17);
        P.line(M + 300, y + 16, M + 500, y + 16, 0.6);
        P.ctext('Construction Representative (Signature)', M + 300, 200, y + 24, 6.6, false);
        P.text('SHL Representative will be present during repair YES/NO', M, y + 36, 7.2, false);
        if (!p1.shlPresent) P.ctext('NOT PRESENT', M + 300, 200, y + 36, 7.4, true);
        P.line(M + 300, y + 39, M + 500, y + 39, 0.6);
        P.ctext('SHL Representative (or Delegate) Signature', M + 300, 200, y + 47, 6.6, false);
        y += 54;
      } else {
        y += 5;
      }
    });

    // general remarks
    const rem = p1.remarks || [];
    const cols = rem.length > 6 ? 2 : 1;
    const per = Math.ceil(rem.length / cols) || 1;
    const gh = Math.max(34, 15 + per * 9);
    P.rect(M, y, CW, gh, 0.8);
    P.text('GENERAL REMARKS:', M + 4, y + 9, 7.2, true);
    rem.forEach((l, i) => {
      const c = Math.floor(i / per), r = i % per;
      const cw = CW / cols;
      P.ctext(l, M + c * cw, cw, y + 19 + r * 9, 7.2, true);
    });
    y += gh + 5;

    // signature block
    const bw = CW / 3, hh2 = 12, rh2 = 13, SIGH = 26;
    const blocks = [
      { t: 'PRODUCTION REPRESENTATIVE (FGJV)', name: p1.prodName || '', desig: p1.prodDesig || '', sig: p1.signature || null },
      { t: 'QUA REPRESENTATIVE (FGJV)', name: '', desig: '' },
      { t: 'CLIENT REPRESENTATIVE (SHL)', name: '', desig: '', np: !p1.shlPresent },
    ];
    blocks.forEach((b, i) => {
      const x0 = M + i * bw;
      P.rectFill(x0, y, bw, hh2, '0.85 0.85 0.85');
      P.rect(x0, y, bw, hh2 + rh2 * 3 + SIGH, 0.8);
      P.line(x0, y + hh2, x0 + bw, y + hh2, 0.8);
      P.ctext(b.t, x0, bw, y + 8.6, 7, true);
      let ry = y + hh2;
      ['NAME:', 'DESIGNATION:', 'SIGNATURE:', 'DATE:'].forEach((lab, r) => {
        const rh = r === 2 ? SIGH : rh2;
        if (r > 0) P.line(x0, ry, x0 + bw, ry, 0.5, '0.4 0.4 0.4');
        P.text(lab, x0 + 3, ry + 9, 6.6, true);
        const lw = strW(lab, 6.6, true) + 8;
        if (r === 0 && b.name) P.text(b.name, x0 + 3 + lw, ry + 9, 7, true);
        if (r === 1 && b.desig) P.text(b.desig, x0 + 3 + lw, ry + 9, 7, true);
        if (r === 2 && b.sig) P.sigImage(b.sig, x0 + 3 + lw, ry + 1, bw - lw - 8, rh - 2);
        ry += rh;
      });
      if (b.np) {
        const ry1 = y + hh2 + rh2, ry2 = y + hh2 + rh2 * 2 + SIGH;
        P.rectFill(x0 + 90, ry1 + 0.5, bw - 91, ry2 - ry1 - 1, '1 1 1');
        P.ctext('NOT PRESENT', x0 + 90, bw - 90, (ry1 + ry2) / 2 + 2.8, 7.6, true);
      }
    });
    y += hh2 + rh2 * 3 + SIGH;
    opts.__page1EndY = y;
    finishPage(P);
  }

  /* ---------- photo pages : two segments per page, side by side ---------- */
  const GAP = 10, COLW = (CW - GAP) / 2;
  for (let i = 0; i < segs.length; i += 2) {
    const pair = [segs[i], segs[i + 1] || null];
    const P = newPage();
    const ticked = pair.filter(Boolean).map((sg) => sg.type).filter(Boolean);
    let top = header(P, opts.title2, opts.formNo + '[A]', opts.utn, null, ticked);
    const SEGH = 16, BAR = 16, BLOCK = Math.floor((792 - 30 - top - SEGH - 4) / 3);
    pair.forEach((seg, c) => {
      const x = M + c * (COLW + GAP);
      let y = top;
      if (seg) {
        P.rect(x, y, COLW, SEGH, 0.8);
        P.ctext('SEGMENT ' + seg.label + (seg.type ? '  -  ' + seg.type : ''), x, COLW, y + 11.5, 9, true);
      }
      y += SEGH + 2;
      opts.stages.forEach((st) => {
        P.rectFill(x, y, COLW, BAR, AMBER);
        P.rect(x, y, COLW, BAR, 0.8);
        P.ctext(st.label, x, COLW, y + 11.5, 9.5, true);
        const areaTop = y + BAR, areaH = BLOCK - BAR - 4;
        P.rect(x, areaTop, COLW, areaH, 0.6);
        const ph = seg && seg.photos ? seg.photos[st.k] : null;
        if (!seg) {
          P.ctext('N/A', x, COLW, areaTop + areaH / 2 + 14, 40, true);
        } else if (ph && ph.bytes) {
          const pad = 4, bw = COLW - 2 * pad, bh = areaH - 2 * pad;
          const sc = Math.min(bw / ph.w, bh / ph.h);
          const dw = ph.w * sc, dh = ph.h * sc;
          P.image(ph, x + pad + (bw - dw) / 2, areaTop + pad + (bh - dh) / 2, dw, dh);
        } else {
          P.ctext('No photo taken', x, COLW, areaTop + areaH / 2 + 3, 10, false, '0.5 0.5 0.5');
        }
        y += BLOCK;
      });
    });
    finishPage(P);
  }

  objs[0] = latin1('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  objs[1] = latin1(`2 0 obj\n<< /Type /Pages /Kids [${kids.map((k) => k + ' 0 R').join(' ')}] /Count ${kids.length} >>\nendobj\n`);
  objs[2] = latin1('3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n');
  objs[3] = latin1('4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj\n');
  objs[4] = latin1(`5 0 obj\n<< /Title (${pdfEsc('Segment repair inspection checklist - UTN ' + opts.utn)}) /Producer (Pop-Out Repair Photos) >>\nendobj\n`);

  const header0 = latin1('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n');
  const out = [header0];
  let pos = header0.length;
  const offsets = [];
  for (const o of objs) { offsets.push(pos); out.push(o); pos += o.length; }
  let xref = `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) xref += String(off).padStart(10, '0') + ' 00000 n \n';
  xref += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R /Info 5 0 R >>\nstartxref\n${pos}\n%%EOF\n`;
  out.push(latin1(xref));
  return concatBytes(out);
}

if (typeof module !== 'undefined') module.exports = { buildPdf, zipStore, crc32, concatBytes, latin1, strW, wrapText, HW, HB };
