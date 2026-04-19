const PDFDocument = require('pdfkit');

function pickLang(req) {
  const q = String(req.query.lang || '').trim().toLowerCase();
  if (q) return q;
  const header = String(req.headers['accept-language'] || '').toLowerCase();
  if (header.startsWith('fr')) return 'fr';
  return 'en';
}

function labelsFor(lang) {
  if (lang === 'fr') {
    return {
      generatedAt: 'Généré le',
      page: 'Page',
    };
  }
  return {
    generatedAt: 'Generated at',
    page: 'Page',
  };
}

function safeText(v) {
  if (v === null || v === undefined) return '';
  return String(v);
}

function sendPdf(res, { filename, title, subtitle, columns, rows, lang }) {
  const labels = labelsFor(lang);
  const now = new Date();
  const generatedAt = now.toISOString();

  const doc = new PDFDocument({
    size: 'A4',
    margin: 42,
    bufferPages: true,
    info: {
      Title: title,
      Author: 'TRANSPO HUB',
    },
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  doc.pipe(res);

  const pageWidth = doc.page.width;
  const margin = doc.page.margins.left;
  const usableWidth = pageWidth - doc.page.margins.left - doc.page.margins.right;

  const headerHeight = 56;
  const footerHeight = 28;

  const colCount = columns.length;
  const colWidths = columns.map((c) => (c.width ? Math.min(c.width, usableWidth) : Math.floor(usableWidth / colCount)));
  const widthSum = colWidths.reduce((s, w) => s + w, 0);
  if (widthSum !== usableWidth) {
    colWidths[colWidths.length - 1] = colWidths[colWidths.length - 1] + (usableWidth - widthSum);
  }

  const drawHeader = () => {
    doc.font('Helvetica-Bold').fontSize(16).fillColor('#111111').text(title, margin, doc.page.margins.top - 10, { width: usableWidth });
    if (subtitle) {
      doc.font('Helvetica').fontSize(10).fillColor('#444444').text(subtitle, margin, doc.y + 4, { width: usableWidth });
    }
    doc.font('Helvetica').fontSize(9).fillColor('#666666').text(`${labels.generatedAt}: ${generatedAt}`, margin, doc.page.margins.top + 28, { width: usableWidth });
    doc.moveDown(1);
    doc.y = doc.page.margins.top + headerHeight;
  };

  const drawFooter = (pageIndex, pageCount) => {
    const y = doc.page.height - doc.page.margins.bottom + 6;
    doc.font('Helvetica').fontSize(9).fillColor('#666666').text(
      `${labels.page} ${pageIndex + 1} / ${pageCount}`,
      margin,
      y,
      { width: usableWidth, align: 'right' }
    );
  };

  const rowHeightFor = (cells) => {
    const paddingY = 6;
    const fontSize = 9;
    doc.font('Helvetica').fontSize(fontSize);
    let max = 0;
    for (let i = 0; i < colCount; i += 1) {
      const w = colWidths[i] - 10;
      const h = doc.heightOfString(safeText(cells[i]), { width: w, align: 'left' });
      max = Math.max(max, h);
    }
    return Math.max(18, Math.ceil(max + paddingY * 2));
  };

  const ensureSpace = (needed) => {
    const bottomLimit = doc.page.height - doc.page.margins.bottom - footerHeight;
    if (doc.y + needed > bottomLimit) {
      doc.addPage();
      drawHeader();
      drawTableHeader();
    }
  };

  const drawTableHeader = () => {
    const y = doc.y;
    doc.save();
    doc.rect(margin, y, usableWidth, 22).fill('#111111');
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(9);
    let x = margin;
    for (let i = 0; i < colCount; i += 1) {
      doc.text(columns[i].label, x + 6, y + 7, { width: colWidths[i] - 12, align: columns[i].align || 'left' });
      x += colWidths[i];
    }
    doc.restore();
    doc.y = y + 24;
  };

  drawHeader();
  drawTableHeader();

  doc.font('Helvetica').fontSize(9).fillColor('#111111');

  for (let r = 0; r < rows.length; r += 1) {
    const cells = rows[r];
    const h = rowHeightFor(cells);
    ensureSpace(h);
    const y = doc.y;
    if (r % 2 === 0) {
      doc.save();
      doc.rect(margin, y, usableWidth, h).fill('#f7f7f7');
      doc.restore();
    }

    let x = margin;
    for (let c = 0; c < colCount; c += 1) {
      doc.fillColor('#111111').font('Helvetica').fontSize(9).text(safeText(cells[c]), x + 6, y + 6, {
        width: colWidths[c] - 12,
        align: columns[c].align || 'left',
      });
      x += colWidths[c];
    }

    doc.y = y + h;
  }

  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i += 1) {
    doc.switchToPage(range.start + i);
    drawFooter(i, range.count);
  }

  doc.end();
}

module.exports = {
  pickLang,
  sendPdf,
};

