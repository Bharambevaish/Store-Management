const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');
const logger = require('./logger');

exports.generateBillPDF = async (bill, res, pageSize = 'A4', template = 'CLASSIC_MEMO_BOOK', setting = null) => {
  let docOptions = { margin: 30 };

  if (template === 'THERMAL_POS' || pageSize === 'THERMAL_80MM') {
    docOptions = { size: [226.77, 750], margin: 10 };
  } else if (pageSize === 'A5') {
    docOptions = { size: 'A5', margin: 20 };
  } else if (pageSize === 'LETTER') {
    docOptions = { size: 'LETTER', margin: 30 };
  } else {
    docOptions = { size: 'A4', margin: 35 };
  }

  const doc = new PDFDocument(docOptions);
  doc.pipe(res);

  const companyName = setting?.companyName || 'NARESH ENTERPRISES';
  const companyContact = setting?.contact || '9822311640, 7020317605';
  const companyEmail = setting?.email || 'contact@nareshenterprises.com';
  const companyAddress = setting?.address || 'Office H. No.34/B, No.31L.H. Colony, Beside Govt. ITI, NANDED';
  const companyGst = (setting?.gstNumber || '').trim();

  const bankName = setting?.bankDetails?.bankName || 'State Bank of India';
  const accountNo = setting?.bankDetails?.accountNo || '12345678901';
  const ifscCode = setting?.bankDetails?.ifscCode || 'SBIN0001234';
  const bankBranch = setting?.bankDetails?.branch || 'Shivajinagar Branch';

  // Load Static Store UPI QR Code or Generate Buffer
  let qrBuffer = null;
  try {
    const staticQrPath = path.join(__dirname, '..', 'assets', 'payment-qr.png');
    if (fs.existsSync(staticQrPath)) {
      qrBuffer = fs.readFileSync(staticQrPath);
    } else {
      const upiUri = `upi://pay?pa=${accountNo}@upi&pn=${encodeURIComponent(companyName)}&am=${(bill.totalAmount || 0).toFixed(2)}&cu=INR`;
      qrBuffer = await QRCode.toBuffer(upiUri, { margin: 1, width: 140 });
    }
  } catch (err) {
    logger.write('error', 'pdf_qr_generation_failed', logger.errorDetails(err));
  }

  // ==================== TEMPLATE 1: CLASSIC RETAIL MEMO BOOK (EXACT MATCH TO PHOTO) ====================
  if (template === 'CLASSIC_MEMO_BOOK') {
    const isA5 = pageSize === 'A5';
    const primaryRed = '#b91c1c';
    const darkText = '#111827';
    const startX = docOptions.margin;
    const endX = isA5 ? 400 : 560;
    const contentWidth = endX - startX;

    // Outer Rounded Double Red Border Frame Box
    const outerBoxHeight = isA5 ? 550 : 770;
    doc.roundedRect(startX - 8, docOptions.margin - 8, contentWidth + 16, outerBoxHeight, 8).strokeColor(primaryRed).lineWidth(1.8).stroke();
    doc.roundedRect(startX - 5, docOptions.margin - 5, contentWidth + 10, outerBoxHeight - 6, 6).strokeColor(primaryRed).lineWidth(0.8).stroke();

    // Top Mobile Contact Line
    doc.fillColor(primaryRed).fontSize(9.5).font('Helvetica-Bold').text(`Mob. ${companyContact}`, startX, docOptions.margin, { align: 'center' });
    doc.moveDown(0.2);

    // Solid Filled Red Header Title Banner Box (White Text on Red Box)
    const headerY = doc.y;
    const bannerHeight = isA5 ? 24 : 28;
    doc.rect(startX, headerY, contentWidth, bannerHeight).fillAndStroke(primaryRed, primaryRed);
    doc.fillColor('#ffffff').fontSize(isA5 ? 16 : 20).font('Helvetica-Bold').text(companyName.toUpperCase(), startX, headerY + (isA5 ? 4 : 5), { align: 'center' });

    // Address Line & Subtitle Category
    let addressY = headerY + bannerHeight + 5;
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor(primaryRed).text(`Add. ${companyAddress}`, startX, addressY, { align: 'center' });
    
    let subCategoryY = addressY + 12;
    doc.fontSize(9.5).font('Helvetica-Bold').fillColor(primaryRed).text('PHARMACEUTICALS & MEDICAL DISTRIBUTORS', startX, subCategoryY, { align: 'center' });

    let line1Y = subCategoryY + 14;
    doc.moveTo(startX, line1Y).lineTo(endX, line1Y).strokeColor(primaryRed).lineWidth(1.2).stroke();

    // Serial No & Date Line
    const serialY = line1Y + 4;
    doc.fontSize(11).font('Helvetica-Bold').fillColor(primaryRed).text(`No. ${bill.invoiceNumber}`, startX + 6, serialY);
    
    const formattedDate = new Date(bill.createdAt).toLocaleDateString();
    doc.fontSize(11).font('Helvetica-Bold').fillColor(primaryRed).text(`Date: ${formattedDate}`, endX - 160, serialY, { align: 'right' });

    let line2Y = serialY + 16;
    doc.moveTo(startX, line2Y).lineTo(endX, line2Y).strokeColor(primaryRed).lineWidth(1.2).stroke();

    // Customer Line (Shri...)
    const customerY = line2Y + 4;
    doc.fontSize(11).font('Helvetica-Bold').fillColor(primaryRed).text('Shri.', startX + 6, customerY);
    const custName = bill.customer?.name ? bill.customer.name : '___________________________________________';
    doc.fontSize(11).font('Helvetica-Bold').fillColor(darkText).text(` ${custName}`, startX + 36, customerY);

    let line3Y = customerY + 16;
    doc.moveTo(startX, line3Y).lineTo(endX, line3Y).strokeColor(primaryRed).lineWidth(1.2).stroke();

    // Table Columns Setup
    let tableY = line3Y;
    const colNoX = startX;
    const colParticularsX = startX + 28;
    const colQtyX = endX - 175;
    const colRateX = endX - 120;
    const colAmountX = endX - 65;
    const colPsX = endX - 30;

    // Sub-header Row with Rs. Ps. split
    const headerBoxHeight = 24;
    doc.rect(startX, tableY, contentWidth, headerBoxHeight).strokeColor(primaryRed).lineWidth(1.2).stroke();
    
    doc.fontSize(9.5).font('Helvetica-Bold').fillColor(primaryRed);
    doc.text('No.', colNoX + 2, tableY + 6, { width: 24, align: 'center' });
    doc.text('Particulars', colParticularsX + 6, tableY + 6);
    doc.text('Qty.', colQtyX, tableY + 6, { width: 50, align: 'center' });
    doc.text('Rate', colRateX, tableY + 6, { width: 50, align: 'center' });
    doc.text('Amount', colAmountX - 5, tableY + 2, { width: 65, align: 'center' });

    // Rs. Ps. divider line
    doc.moveTo(colAmountX - 5, tableY + 13).lineTo(endX, tableY + 13).strokeColor(primaryRed).lineWidth(0.8).stroke();
    doc.fontSize(8).font('Helvetica-Bold').fillColor(primaryRed);
    doc.text('Rs.', colAmountX - 2, tableY + 14, { width: 30, align: 'center' });
    doc.text('Ps.', colPsX - 2, tableY + 14, { width: 28, align: 'center' });

    // Main Table Grid Body
    const gridBodyY = tableY + headerBoxHeight;
    const gridHeight = isA5 ? 240 : 380;
    doc.rect(startX, gridBodyY, contentWidth, gridHeight).strokeColor(primaryRed).lineWidth(1.2).stroke();

    // Solid Vertical Red Grid Lines
    doc.moveTo(colParticularsX, gridBodyY).lineTo(colParticularsX, gridBodyY + gridHeight).strokeColor(primaryRed).lineWidth(1).stroke();
    doc.moveTo(colQtyX, gridBodyY).lineTo(colQtyX, gridBodyY + gridHeight).strokeColor(primaryRed).lineWidth(1).stroke();
    doc.moveTo(colRateX, gridBodyY).lineTo(colRateX, gridBodyY + gridHeight).strokeColor(primaryRed).lineWidth(1).stroke();
    doc.moveTo(colAmountX - 5, gridBodyY).lineTo(colAmountX - 5, gridBodyY + gridHeight).strokeColor(primaryRed).lineWidth(1).stroke();
    doc.moveTo(colPsX - 5, gridBodyY).lineTo(colPsX - 5, gridBodyY + gridHeight).strokeColor(primaryRed).lineWidth(0.8).stroke();

    // Populate Row Items (Pre-formatted 1 to 15 rows like memo book)
    const maxRows = 15;
    let rowY = gridBodyY + 4;
    const rowHeight = isA5 ? 15 : 24;

    for (let i = 0; i < maxRows; i++) {
      const item = bill.items && bill.items[i] ? bill.items[i] : null;

      // Draw light horizontal row guide line
      if (i > 0) {
        doc.moveTo(startX, rowY - 2).lineTo(endX, rowY - 2).strokeColor('#fca5a5').lineWidth(0.4).stroke();
      }

      doc.fontSize(9).font('Helvetica-Bold').fillColor(primaryRed);
      doc.text(`${i + 1}.`, colNoX + 2, rowY, { width: 24, align: 'center' });

      if (item) {
        doc.fontSize(9.5).font('Helvetica-Bold').fillColor(darkText);
        doc.text(item.product?.name || 'Medicine / Item', colParticularsX + 6, rowY, { width: colQtyX - colParticularsX - 10 });
        doc.text(`${item.quantity} ${item.product?.unit || 'pcs'}`, colQtyX, rowY, { width: 50, align: 'center' });
        doc.text((item.price || 0).toFixed(2), colRateX, rowY, { width: 50, align: 'right' });
        
        const lineTotal = (item.price || 0) * (item.quantity || 0);
        const parts = lineTotal.toFixed(2).split('.');
        doc.text(parts[0], colAmountX - 4, rowY, { width: 32, align: 'right' });
        doc.text(parts[1], colPsX - 4, rowY, { width: 28, align: 'center' });
      }

      rowY += rowHeight;
    }

    // TOTAL Row Box
    const totalBoxY = gridBodyY + gridHeight;
    doc.rect(startX, totalBoxY, contentWidth, 24).strokeColor(primaryRed).lineWidth(1.2).stroke();
    doc.fontSize(11).font('Helvetica-Bold').fillColor(primaryRed);
    doc.text('TOTAL', colRateX - 45, totalBoxY + 6, { width: 90, align: 'right' });

    const grandParts = (bill.totalAmount || 0).toFixed(2).split('.');
    doc.fontSize(11).font('Helvetica-Bold').fillColor(primaryRed);
    doc.text(grandParts[0], colAmountX - 4, totalBoxY + 6, { width: 32, align: 'right' });
    doc.text(grandParts[1], colPsX - 4, totalBoxY + 6, { width: 28, align: 'center' });

    // Master Bank Payment Details & Payment QR Code (Red Bordered Frame)
    const footerY = totalBoxY + 28;
    doc.rect(startX, footerY, contentWidth, 85).strokeColor(primaryRed).lineWidth(1).stroke();

    doc.fontSize(9).font('Helvetica-Bold').fillColor(primaryRed).text('BANK PAYMENT DETAILS:', startX + 8, footerY + 6);
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor(darkText);
    doc.text(`Bank Name: ${bankName}`, startX + 8, footerY + 20);
    doc.text(`A/C No: ${accountNo}`, startX + 8, footerY + 33);
    doc.text(`IFSC Code: ${ifscCode}`, startX + 8, footerY + 46);
    doc.text(`Branch: ${bankBranch}`, startX + 8, footerY + 59);

    if (qrBuffer) {
      const qrX = endX - 160;
      doc.image(qrBuffer, qrX, footerY + 5, { width: 62, height: 62 });
      doc.fontSize(8).font('Helvetica-Bold').fillColor(primaryRed).text('Scan to Pay via UPI', qrX + 68, footerY + 28);
    }

    // Footer Signatures (Thank You... & For: SHOP NAME)
    const signatureY = footerY + 92;
    doc.fontSize(11).font('Helvetica-BoldOblique').fillColor(primaryRed).text('Thank You...', startX + 10, signatureY);
    doc.fontSize(10.5).font('Helvetica-Bold').fillColor(primaryRed).text(`For: ${companyName.toUpperCase()}`, endX - 240, signatureY, { align: 'right' });

    doc.end();
    return;
  }

  // ==================== TEMPLATE 2: MODERN CORPORATE / MINIMAL / DEFAULT ====================
  const isA5 = pageSize === 'A5';
  const startX = docOptions.margin;
  const endX = isA5 ? 395 : 555;
  const contentWidth = endX - startX;

  // Master Shop Header (Left Side)
  doc.fillColor('#0f172a').fontSize(isA5 ? 14 : 18).font('Helvetica-Bold').text(companyName, startX, docOptions.margin);
  doc.fontSize(8.5).font('Helvetica').fillColor('#475569');
  doc.text(`Address: ${companyAddress}`, startX, doc.y + 2, { width: isA5 ? 180 : 250 });
  doc.text(`Contact: ${companyContact} | Email: ${companyEmail}`, startX, doc.y + 2);
  if (companyGst && companyGst.trim()) {
    doc.text(`GSTIN: ${companyGst.trim()}`, startX, doc.y + 2);
  }

  // Title Meta (Right Side)
  const headerRightX = endX - 180;
  doc.fillColor('#0f172a').fontSize(isA5 ? 16 : 20).font('Helvetica-Bold').text('TAX INVOICE', headerRightX, docOptions.margin, { align: 'right' });
  doc.fontSize(8.5).font('Helvetica').fillColor('#64748b').text('Original Copy', headerRightX, docOptions.margin + 24, { align: 'right' });
  doc.text(`Invoice No: ${bill.invoiceNumber}`, headerRightX, docOptions.margin + 36, { align: 'right' });
  doc.text(`Date: ${new Date(bill.createdAt).toLocaleDateString()}`, headerRightX, docOptions.margin + 48, { align: 'right' });
  doc.text(`Status: ${bill.status}`, headerRightX, docOptions.margin + 60, { align: 'right' });

  doc.moveDown(3);
  doc.moveTo(startX, doc.y).lineTo(endX, doc.y).strokeColor('#cbd5e1').lineWidth(1).stroke();
  doc.moveDown(1);

  // Customer Section
  const customerY = doc.y;
  doc.fillColor('#0f172a').fontSize(10).font('Helvetica-Bold').text('Billed To:', startX, customerY);
  doc.fontSize(9).font('Helvetica').fillColor('#334155');
  doc.text(bill.customer?.name || 'Walk-in Customer', startX, customerY + 14);
  doc.text(`Mobile: ${bill.customer?.mobile || '-'}`, startX, customerY + 26);
  doc.text(`Address: ${bill.customer?.address || '-'}`, startX, customerY + 38, { width: 250 });
  if (bill.customer?.gstNumber && bill.customer.gstNumber.trim()) {
    doc.text(`GSTIN: ${bill.customer.gstNumber.trim()}`, startX, customerY + 62);
  }

  doc.moveDown(3.5);

  // Table Headers
  let tableY = doc.y + 20;
  const colRightX = isA5 ? 240 : 320;
  const col4X = isA5 ? 320 : 440;

  doc.fillColor('#475569').fontSize(9).font('Helvetica-Bold');
  doc.text('Item Description', startX, tableY);
  doc.text('Price (Rs.)', colRightX - 80, tableY, { width: 70, align: 'right' });
  doc.text('Qty', colRightX, tableY, { width: 40, align: 'right' });
  doc.text('GST Rate', colRightX + 50, tableY, { width: 50, align: 'right' });
  doc.text('Amount (Rs.)', col4X, tableY, { width: isA5 ? 70 : 100, align: 'right' });

  doc.moveTo(startX, tableY + 15).lineTo(endX, tableY + 15).strokeColor('#cbd5e1').lineWidth(1).stroke();

  // Table Items
  let itemY = tableY + 24;
  doc.fillColor('#0f172a').font('Helvetica');
  bill.items.forEach(item => {
    doc.text(item.product?.name || 'Item', startX, itemY, { width: isA5 ? 120 : 180 });
    doc.text((item.price || 0).toFixed(2), colRightX - 80, itemY, { width: 70, align: 'right' });
    doc.text(`${item.quantity} ${item.product?.unit || 'pcs'}`, colRightX, itemY, { width: 40, align: 'right' });
    
    const taxRate = (item.cgst || 0) + (item.sgst || 0) + (item.igst || 0);
    doc.text(`${taxRate}%`, colRightX + 50, itemY, { width: 50, align: 'right' });
    
    const lineTotal = (item.price || 0) * (item.quantity || 0);
    doc.text(lineTotal.toFixed(2), col4X, itemY, { width: isA5 ? 70 : 100, align: 'right' });
    
    itemY += 18;
  });

  doc.moveTo(startX, itemY).lineTo(endX, itemY).strokeColor('#cbd5e1').stroke();

  // Subtotal & Grand Total
  let summaryY = itemY + 12;
  doc.fillColor('#475569').fontSize(9);
  doc.text('Subtotal:', colRightX, summaryY, { width: 110, align: 'right' });
  doc.fillColor('#0f172a').text((bill.subtotal || 0).toFixed(2), col4X, summaryY, { width: isA5 ? 70 : 100, align: 'right' });

  if (bill.cgstTotal > 0) {
    summaryY += 14;
    doc.fillColor('#475569').text('CGST:', colRightX, summaryY, { width: 110, align: 'right' });
    doc.fillColor('#0f172a').text(bill.cgstTotal.toFixed(2), col4X, summaryY, { width: isA5 ? 70 : 100, align: 'right' });
  }

  if (bill.sgstTotal > 0) {
    summaryY += 14;
    doc.fillColor('#475569').text('SGST:', colRightX, summaryY, { width: 110, align: 'right' });
    doc.fillColor('#0f172a').text(bill.sgstTotal.toFixed(2), col4X, summaryY, { width: isA5 ? 70 : 100, align: 'right' });
  }

  summaryY += 18;
  doc.moveTo(colRightX, summaryY - 4).lineTo(endX, summaryY - 4).strokeColor('#94a3b8').stroke();
  doc.fillColor('#0f172a').fontSize(11).font('Helvetica-Bold');
  doc.text('Grand Total:', colRightX, summaryY, { width: 110, align: 'right' });
  doc.text(`Rs. ${(bill.totalAmount || 0).toFixed(2)}`, col4X, summaryY, { width: isA5 ? 70 : 100, align: 'right' });

  // Bottom Footer: Bank Payment Details & Payment QR Code (Master Options)
  const bankFooterY = Math.max(summaryY + 45, doc.y + 45);
  doc.moveTo(startX, bankFooterY - 10).lineTo(endX, bankFooterY - 10).strokeColor('#e2e8f0').lineWidth(1).stroke();

  doc.fontSize(9).font('Helvetica-Bold').fillColor('#0f172a').text('BANK PAYMENT DETAILS', startX, bankFooterY);
  doc.fontSize(8.5).font('Helvetica').fillColor('#475569');
  doc.text(`Bank Name: ${bankName}`, startX, bankFooterY + 14);
  doc.text(`Account No: ${accountNo}`, startX, bankFooterY + 26);
  doc.text(`IFSC Code: ${ifscCode}`, startX, bankFooterY + 38);
  doc.text(`Branch: ${bankBranch}`, startX, bankFooterY + 50);

  if (qrBuffer) {
    const qrX = endX - 160;
    doc.image(qrBuffer, qrX, bankFooterY, { width: 65, height: 65 });
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#0f172a').text('Scan to Pay via UPI', qrX + 72, bankFooterY + 25);
  } else {
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#0f172a').text(`For: ${companyName}`, endX - 180, bankFooterY + 35, { align: 'right' });
  }

  doc.end();
};

exports.generateQuotationPDF = (quotation, res, pageSize = 'A4') => {
  let docOptions = { margin: 40 };

  if (pageSize === 'A5') {
    docOptions = { size: 'A5', margin: 25 };
  } else if (pageSize === 'LETTER') {
    docOptions = { size: 'LETTER', margin: 40 };
  } else {
    docOptions = { size: 'A4', margin: 50 };
  }

  const doc = new PDFDocument(docOptions);
  doc.pipe(res);

  const isA5 = pageSize === 'A5';
  const rightAlignX = isA5 ? 390 : 540;
  const colRightX = isA5 ? 240 : 320;
  const col4X = isA5 ? 320 : 440;

  // Header Details
  doc.fillColor('#0369a1').fontSize(isA5 ? 18 : 22).font('Helvetica-Bold').text('QUOTATION', { align: 'right' });
  doc.fontSize(9).font('Helvetica').fillColor('#64748b').text(`Estimates Only • Format: ${pageSize}`, { align: 'right' });
  doc.moveDown(1.5);

  // columns
  const initialY = doc.y;
  doc.fillColor('#0f172a').fontSize(isA5 ? 10 : 12).font('Helvetica-Bold').text('Prepared For:', docOptions.margin, initialY);
  doc.fontSize(9).font('Helvetica').fillColor('#334155');
  doc.text(quotation.customer?.name || 'Walk-in', docOptions.margin, initialY + 14);
  doc.text(`Mobile: ${quotation.customer?.mobile || '-'}`, docOptions.margin, initialY + 28);
  doc.text(`Address: ${quotation.customer?.address || '-'}`, docOptions.margin, initialY + 42, { width: isA5 ? 160 : 220 });
  if (quotation.customer?.gstNumber && quotation.customer.gstNumber.trim()) {
    doc.text(`GSTIN: ${quotation.customer.gstNumber.trim()}`, docOptions.margin, doc.y + 2);
  }

  // Quotation Meta
  doc.fillColor('#0f172a').fontSize(isA5 ? 10 : 12).font('Helvetica-Bold').text('Quotation Details:', colRightX, initialY);
  doc.fontSize(9).font('Helvetica').fillColor('#334155');
  doc.text(`Quotation ID: Q-${quotation._id.toString().substring(18).toUpperCase()}`, colRightX, initialY + 14);
  doc.text(`Date: ${new Date(quotation.createdAt).toLocaleDateString()}`, colRightX, initialY + 28);
  doc.text(`Valid Until: ${quotation.validUntil ? new Date(quotation.validUntil).toLocaleDateString() : 'N/A'}`, colRightX, initialY + 42);

  doc.moveDown(3);

  // Table Columns Headers
  let tableY = doc.y + 30;
  doc.fillColor('#475569').fontSize(9).font('Helvetica-Bold');
  doc.text('Item Description', docOptions.margin, tableY);
  doc.text('Unit Price (Rs.)', colRightX - 60, tableY, { width: 80, align: 'right' });
  doc.text('Quantity', colRightX + 30, tableY, { width: 60, align: 'right' });
  doc.text('Subtotal (Rs.)', col4X, tableY, { width: isA5 ? 70 : 100, align: 'right' });

  // Border line under header
  doc.moveTo(docOptions.margin, tableY + 15).lineTo(rightAlignX, tableY + 15).strokeColor('#cbd5e1').lineWidth(1).stroke();

  let itemY = tableY + 25;
  doc.fillColor('#0f172a').font('Helvetica');
  quotation.items.forEach(item => {
    doc.text(item.product?.name || 'Item', docOptions.margin, itemY, { width: isA5 ? 140 : 200 });
    doc.text((item.price || 0).toFixed(2), colRightX - 60, itemY, { width: 80, align: 'right' });
    doc.text(`${item.quantity} ${item.product?.unit || 'pcs'}`, colRightX + 30, itemY, { width: 60, align: 'right' });
    
    const lineTotal = (item.price || 0) * (item.quantity || 0);
    doc.text(lineTotal.toFixed(2), col4X, itemY, { width: isA5 ? 70 : 100, align: 'right' });
    
    itemY += 18;
  });

  // Border line under items
  doc.moveTo(docOptions.margin, itemY).lineTo(rightAlignX, itemY).strokeColor('#cbd5e1').stroke();

  // Summary figures
  let summaryY = itemY + 15;
  doc.fillColor('#0f172a').fontSize(11).font('Helvetica-Bold');
  doc.text('Estimated Total:', colRightX, summaryY, { width: 110, align: 'right' });
  doc.text(`Rs. ${(quotation.totalAmount || 0).toFixed(2)}`, col4X, summaryY, { width: isA5 ? 70 : 100, align: 'right' });

  doc.end();
};

exports.generateCustomerStatementPDF = async (customer, ledger = [], res, setting = null, pageSize = 'A4') => {
  if (!setting) {
    try {
      const Setting = require('../models/setting');
      setting = await Setting.findOne({});
    } catch (_) {}
  }

  let docOptions = { margin: 40 };
  if (pageSize === 'A5') {
    docOptions = { size: 'A5', margin: 25 };
  } else if (pageSize === 'LETTER') {
    docOptions = { size: 'LETTER', margin: 40 };
  } else {
    docOptions = { size: 'A4', margin: 40 };
  }

  const doc = new PDFDocument(docOptions);
  doc.pipe(res);

  const startX = docOptions.margin;
  const endX = 555;
  const contentWidth = endX - startX;

  const companyName = setting?.companyName || 'NARESH ENTERPRISES';
  const companyContact = setting?.contact || '9822311640, 7020317605';
  const companyEmail = setting?.email || 'contact@nareshenterprises.com';
  const companyAddress = setting?.address || 'Office H. No.34/B, No.31L.H. Colony, Beside Govt. ITI, NANDED';
  const companyGst = (setting?.gstNumber || '').trim();

  // Master Shop Header (Left Side) — Consistent with generateBillPDF
  doc.fillColor('#0f172a').fontSize(18).font('Helvetica-Bold').text(companyName, startX, docOptions.margin);
  doc.fontSize(8.5).font('Helvetica').fillColor('#475569');
  doc.text(`Address: ${companyAddress}`, startX, doc.y + 2, { width: 250 });
  doc.text(`Contact: ${companyContact} | Email: ${companyEmail}`, startX, doc.y + 2);
  if (companyGst && companyGst.trim()) {
    doc.text(`GSTIN: ${companyGst.trim()}`, startX, doc.y + 2);
  }

  // Title Meta (Right Side)
  const headerRightX = endX - 190;
  doc.fillColor('#0f172a').fontSize(20).font('Helvetica-Bold').text('STATEMENT', headerRightX, docOptions.margin, { align: 'right' });
  doc.fontSize(8.5).font('Helvetica').fillColor('#64748b').text('Account Ledger', headerRightX, docOptions.margin + 24, { align: 'right' });
  doc.text(`Date: ${new Date().toLocaleDateString('en-IN')}`, headerRightX, docOptions.margin + 36, { align: 'right' });
  
  const totalOutstanding = ledger.length > 0 ? (ledger[ledger.length - 1].runningBalance || 0) : 0;
  doc.fontSize(9).font('Helvetica-Bold').fillColor(totalOutstanding > 0 ? '#b91c1c' : '#15803d');
  doc.text(`Balance: Rs. ${totalOutstanding.toFixed(2)}`, headerRightX, docOptions.margin + 48, { align: 'right' });

  doc.moveDown(3);
  doc.moveTo(startX, doc.y).lineTo(endX, doc.y).strokeColor('#cbd5e1').lineWidth(1).stroke();
  doc.moveDown(1);

  // Customer Details Section
  doc.fillColor('#0f172a').fontSize(10).font('Helvetica-Bold').text('Customer Statement For:', startX, doc.y + 10);
  doc.fontSize(9).font('Helvetica').fillColor('#334155');
  doc.text(customer?.name || 'Walk-in Customer', startX, doc.y + 3);
  doc.text(`Mobile: ${customer?.mobile || '-'}`, startX, doc.y + 2);
  doc.text(`Address: ${customer?.address || '-'}`, startX, doc.y + 2, { width: 320 });
  
  if (customer?.gstNumber && customer.gstNumber.trim()) {
    doc.text(`GSTIN: ${customer.gstNumber.trim()}`, startX, doc.y + 2);
  }
  const creditLimitText = customer?.creditLimit > 0 ? `Rs. ${customer.creditLimit.toFixed(2)}` : 'Unlimited / None';
  doc.text(`Credit Limit: ${creditLimitText}`, startX, doc.y + 2);

  // Table Headers
  const tableY = doc.y + 14;
  doc.rect(startX, tableY, contentWidth, 20).fillColor('#f1f5f9').fill();
  doc.fillColor('#334155').fontSize(8.5).font('Helvetica-Bold');
  doc.text('Date', startX + 6, tableY + 6, { width: 65 });
  doc.text('Type / Particulars', startX + 75, tableY + 6, { width: 135 });
  doc.text('Reference', startX + 215, tableY + 6, { width: 85 });
  doc.text('Debit (Rs.)', startX + 305, tableY + 6, { width: 70, align: 'right' });
  doc.text('Credit (Rs.)', startX + 380, tableY + 6, { width: 70, align: 'right' });
  doc.text('Balance (Rs.)', startX + 455, tableY + 6, { width: 55, align: 'right' });

  doc.moveTo(startX, tableY + 20).lineTo(endX, tableY + 20).strokeColor('#cbd5e1').lineWidth(1).stroke();

  let rowY = tableY + 26;

  if (!ledger || ledger.length === 0) {
    doc.fillColor('#64748b').fontSize(9).font('Helvetica-Oblique');
    doc.text('No transactions recorded for this customer.', startX, rowY + 10, { width: contentWidth, align: 'center' });
    rowY += 35;
    doc.moveTo(startX, rowY).lineTo(endX, rowY).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
  } else {
    doc.font('Helvetica').fontSize(8.5);
    let totalDebit = 0;
    let totalCredit = 0;

    ledger.forEach((item, idx) => {
      if (rowY > 710) {
        doc.addPage();
        rowY = 40;
      }

      if (idx % 2 === 1) {
        doc.rect(startX, rowY - 2, contentWidth, 18).fillColor('#f8fafc').fill();
      }

      totalDebit += (item.debit || 0);
      totalCredit += (item.credit || 0);

      const formattedDate = item.date ? new Date(item.date).toLocaleDateString('en-IN') : '-';
      doc.fillColor('#0f172a');
      doc.text(formattedDate, startX + 6, rowY + 3, { width: 65 });
      doc.text(item.type || 'Transaction', startX + 75, rowY + 3, { width: 135 });
      doc.text(item.ref || '-', startX + 215, rowY + 3, { width: 85 });
      doc.text((item.debit || 0) > 0 ? (item.debit).toFixed(2) : '-', startX + 305, rowY + 3, { width: 70, align: 'right' });
      doc.text((item.credit || 0) > 0 ? (item.credit).toFixed(2) : '-', startX + 380, rowY + 3, { width: 70, align: 'right' });
      doc.text((item.runningBalance || 0).toFixed(2), startX + 455, rowY + 3, { width: 55, align: 'right' });

      rowY += 18;
    });

    // Divider before total
    doc.moveTo(startX, rowY + 2).lineTo(endX, rowY + 2).strokeColor('#cbd5e1').lineWidth(1).stroke();
    rowY += 8;

    // Total summary row
    doc.rect(startX, rowY, contentWidth, 22).fillColor('#f1f5f9').fill();
    doc.fillColor('#0f172a').fontSize(9).font('Helvetica-Bold');
    doc.text('Total:', startX + 75, rowY + 6, { width: 135 });
    doc.text(totalDebit.toFixed(2), startX + 305, rowY + 6, { width: 70, align: 'right' });
    doc.text(totalCredit.toFixed(2), startX + 380, rowY + 6, { width: 70, align: 'right' });
    doc.text((totalDebit - totalCredit).toFixed(2), startX + 455, rowY + 6, { width: 55, align: 'right' });
    rowY += 26;
  }

  // Account Summary Card
  const summaryBoxY = Math.max(rowY + 15, doc.y + 15);
  doc.rect(startX, summaryBoxY, contentWidth, 40).strokeColor('#cbd5e1').lineWidth(1).stroke();
  doc.fillColor('#0f172a').fontSize(10).font('Helvetica-Bold');
  doc.text('Account Summary', startX + 12, summaryBoxY + 8);
  doc.fontSize(8.5).font('Helvetica').fillColor('#475569');
  doc.text(`Total Transactions: ${ledger.length}`, startX + 12, summaryBoxY + 22);

  const closingBalance = ledger.length > 0 ? (ledger[ledger.length - 1].runningBalance || 0) : 0;
  doc.fillColor(closingBalance > 0 ? '#b91c1c' : '#15803d').font('Helvetica-Bold');
  doc.text(
    `Closing Balance: Rs. ${closingBalance.toFixed(2)} ${closingBalance > 0 ? '(Payment Due)' : '(Cleared)'}`,
    endX - 260,
    summaryBoxY + 14,
    { width: 250, align: 'right' }
  );

  // Sign-off
  const footerY = summaryBoxY + 60;
  doc.fontSize(9).font('Helvetica-Bold').fillColor('#0f172a').text(`For: ${companyName}`, endX - 220, footerY, { align: 'right' });
  doc.fontSize(8).font('Helvetica').fillColor('#64748b').text('Authorized Signatory', endX - 220, footerY + 14, { align: 'right' });

  doc.end();
};

