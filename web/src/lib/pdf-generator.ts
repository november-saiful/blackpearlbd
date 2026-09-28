import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Booking } from '../types';

// Brand colors
const PRIMARY: [number, number, number] = [15, 23, 42];      // slate-900
const ACCENT: [number, number, number] = [99, 102, 241];     // indigo-500
const MUTED: [number, number, number] = [100, 116, 139];     // slate-500
const LIGHT_BG: [number, number, number] = [241, 245, 249];  // slate-100
const WHITE: [number, number, number] = [255, 255, 255];
const BORDER: [number, number, number] = [226, 232, 240];    // slate-200
const GREEN: [number, number, number] = [22, 163, 74];       // green-600
const RED: [number, number, number] = [220, 38, 38];         // red-600

function formatBDT(amount: number): string {
  return `BDT ${amount.toLocaleString('en-BD')}`;
}

export function generateInvoicePDF(booking: Booking) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;

  // ── Accent bar at top ────────────────────────────────────────────
  doc.setFillColor(...ACCENT);
  doc.rect(0, 0, pageWidth, 4, 'F');

  // ── Header: Company name left, Invoice title right ───────────────
  let y = 20;

  doc.setFontSize(22);
  doc.setTextColor(...PRIMARY);
  doc.setFont('helvetica', 'bold');
  doc.text('BlackPearl', margin, y);

  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.setFont('helvetica', 'normal');
  doc.text('Tours & Travel Agency', margin, y + 7);

  // Invoice badge (right side)
  const badgeWidth = 50;
  doc.setFillColor(...ACCENT);
  doc.roundedRect(pageWidth - margin - badgeWidth, y - 10, badgeWidth, 16, 2, 2, 'F');
  doc.setTextColor(...WHITE);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('INVOICE', pageWidth - margin - badgeWidth / 2, y + 1, { align: 'center' });

  y += 18;

  // ── Invoice meta (below header) ──────────────────────────────────
  const invoiceId = booking.invoice_number || booking.deal?.deal_code || booking.id;

  doc.setFillColor(...LIGHT_BG);
  doc.roundedRect(margin, y, contentWidth, 30, 2, 2, 'F');

  const col1 = margin + 6;
  const col2 = pageWidth / 2 + 6;
  let metaY = y + 9;

  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.setFont('helvetica', 'normal');
  doc.text('INVOICE NO.', col1, metaY);
  doc.text('DATE', col2, metaY);

  metaY += 6;
  doc.setFontSize(10);
  doc.setTextColor(...PRIMARY);
  doc.setFont('helvetica', 'bold');
  doc.text(invoiceId, col1, metaY);
  doc.setFont('helvetica', 'normal');
  doc.text(new Date(booking.booked_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }), col2, metaY);

  metaY += 9;
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.setFont('helvetica', 'normal');
  doc.text('PAYMENT STATUS', col1, metaY);
  doc.text('BOOKING STATUS', col2, metaY);

  metaY += 6;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');

  // Payment status with color
  const paymentColor = booking.payment_status === 'paid' ? GREEN : PRIMARY;
  doc.setTextColor(...paymentColor);
  doc.text(booking.payment_status.toUpperCase(), col1, metaY);

  // Booking status with color
  const statusColor = booking.status === 'approved' ? GREEN
    : booking.status === 'rejected' ? RED
    : PRIMARY;
  doc.setTextColor(...statusColor);
  doc.text(booking.status.toUpperCase(), col2, metaY);

  y += 40;

  // ── Divider ──────────────────────────────────────────────────────
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  // ── Customer Details ─────────────────────────────────────────────
  doc.setFontSize(11);
  doc.setTextColor(...PRIMARY);
  doc.setFont('helvetica', 'bold');
  doc.text('Customer Details', margin, y);
  y += 8;

  const travelerDetails = (booking.traveler_details || {}) as Record<string, string>;
  const customerInfo: string[][] = [
    ['Name', travelerDetails.name || 'N/A'],
    ['Email', travelerDetails.email || 'N/A'],
    ['Phone', travelerDetails.phone || 'N/A'],
    ['Emergency Contact', travelerDetails.emergency_contact || 'N/A'],
  ];

  autoTable(doc, {
    startY: y,
    head: [],
    body: customerInfo,
    theme: 'plain',
    styles: {
      fontSize: 9,
      cellPadding: { top: 3, bottom: 3, left: 0, right: 0 },
      textColor: [...MUTED],
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 45, textColor: [...PRIMARY] },
      1: { textColor: [51, 65, 85] },
    },
    margin: { left: margin, right: margin },
  });

  y = (doc as any).lastAutoTable?.finalY + 12;

  // ── Booking Details ──────────────────────────────────────────────
  doc.setFontSize(11);
  doc.setTextColor(...PRIMARY);
  doc.setFont('helvetica', 'bold');
  doc.text('Booking Details', margin, y);
  y += 8;

  const deal = booking.deal;
  const pkg = booking.custom_package;
  const bookingType = booking.booking_type === 'deal' ? 'Tour Deal' : 'Custom Package';

  const bookingInfo: string[][] = [
    ['Type', bookingType],
  ];

  if (booking.booking_type === 'deal') {
    bookingInfo.push(['Tour Code', deal?.deal_code || 'N/A']);
    bookingInfo.push(['Title', deal?.title || 'N/A']);
    bookingInfo.push(['Destination', deal?.destination || 'N/A']);
    bookingInfo.push(['Duration', deal?.duration_days ? `${deal.duration_days} days` : 'N/A']);
  } else {
    bookingInfo.push(['Package Code', pkg?.package_code || 'N/A']);
    bookingInfo.push(['Title', pkg?.title || 'N/A']);
    bookingInfo.push(['Travelers', String(pkg?.num_travelers || 1)]);
    if (pkg?.travel_date) {
      bookingInfo.push(['Travel Date', new Date(pkg.travel_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })]);
    }
  }

  autoTable(doc, {
    startY: y,
    head: [],
    body: bookingInfo,
    theme: 'plain',
    styles: {
      fontSize: 9,
      cellPadding: { top: 3, bottom: 3, left: 0, right: 0 },
      textColor: [...MUTED],
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 45, textColor: [...PRIMARY] },
      1: { textColor: [51, 65, 85] },
    },
    margin: { left: margin, right: margin },
  });

  y = (doc as any).lastAutoTable?.finalY + 12;

  // ── Tour Description (if available) ──────────────────────────────
  if (deal?.description) {
    if (y > pageHeight - 80) {
      doc.addPage();
      y = 20;
    }

    doc.setFontSize(11);
    doc.setTextColor(...PRIMARY);
    doc.setFont('helvetica', 'bold');
    doc.text('Tour Description', margin, y);
    y += 7;

    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.setFont('helvetica', 'normal');
    const descLines = doc.splitTextToSize(deal.description, contentWidth);
    doc.text(descLines, margin, y);
    y += descLines.length * 4.5 + 10;
  }

  // ── Inclusions & Exclusions ──────────────────────────────────────
  if ((deal?.inclusions && deal.inclusions.length > 0) || (deal?.exclusions && deal.exclusions.length > 0)) {
    if (y > pageHeight - 80) {
      doc.addPage();
      y = 20;
    }

    // Inclusions
    if (deal?.inclusions && deal.inclusions.length > 0) {
      doc.setFontSize(10);
      doc.setTextColor(...GREEN);
      doc.setFont('helvetica', 'bold');
      doc.text('Inclusions', margin, y);
      y += 6;

      doc.setFontSize(9);
      doc.setTextColor(...MUTED);
      doc.setFont('helvetica', 'normal');
      deal.inclusions.forEach((item) => {
        if (y > pageHeight - 20) { doc.addPage(); y = 20; }
        doc.text(`+ ${item}`, margin + 4, y);
        y += 5;
      });
      y += 4;
    }

    // Exclusions
    if (deal?.exclusions && deal.exclusions.length > 0) {
      doc.setFontSize(10);
      doc.setTextColor(...RED);
      doc.setFont('helvetica', 'bold');
      doc.text('Exclusions', margin, y);
      y += 6;

      doc.setFontSize(9);
      doc.setTextColor(...MUTED);
      doc.setFont('helvetica', 'normal');
      deal.exclusions.forEach((item) => {
        if (y > pageHeight - 20) { doc.addPage(); y = 20; }
        doc.text(`- ${item}`, margin + 4, y);
        y += 5;
      });
      y += 4;
    }
  }

  // ── Price Breakdown ──────────────────────────────────────────────
  if (y > pageHeight - 60) {
    doc.addPage();
    y = 20;
  }

  // Price card background
  const priceCardTop = y;
  const priceLines: string[][] = [
    ['Subtotal', formatBDT(booking.total_amount)],
  ];

  if (deal?.original_price && deal.original_price > deal.price) {
    const discount = deal.original_price - deal.price;
    const pct = Math.round((1 - deal.price / deal.original_price) * 100);
    priceLines.push(['Original Price', formatBDT(deal.original_price)]);
    priceLines.push([`Discount (${pct}% off)`, `-${formatBDT(discount)}`]);
  }

  priceLines.push(['Taxes & Fees', 'BDT 0']);

  // Reserve space — we'll draw the card after the table
  const estimatedTableHeight = priceLines.length * 8 + 30;
  const cardBottom = priceCardTop + estimatedTableHeight;

  doc.setFillColor(...LIGHT_BG);
  doc.roundedRect(margin, priceCardTop, contentWidth, estimatedTableHeight, 2, 2, 'F');

  doc.setFontSize(11);
  doc.setTextColor(...PRIMARY);
  doc.setFont('helvetica', 'bold');
  doc.text('Price Breakdown', margin + 6, y + 8);
  y += 16;

  autoTable(doc, {
    startY: y,
    head: [],
    body: priceLines,
    theme: 'plain',
    styles: {
      fontSize: 9,
      cellPadding: { top: 3, bottom: 3, left: 0, right: 0 },
      textColor: [...MUTED],
    },
    columnStyles: {
      0: { textColor: [...MUTED] },
      1: { halign: 'right', textColor: [51, 65, 85] },
    },
    margin: { left: margin + 6, right: margin + 6 },
  });

  y = (doc as any).lastAutoTable?.finalY + 4;

  // Total row
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.3);
  doc.line(margin + 6, y, pageWidth - margin - 6, y);
  y += 7;

  doc.setFontSize(12);
  doc.setTextColor(...PRIMARY);
  doc.setFont('helvetica', 'bold');
  doc.text('Total', margin + 6, y);
  doc.text(formatBDT(booking.total_amount), pageWidth - margin - 6, y, { align: 'right' });

  y = Math.max(y + 8, cardBottom + 4);

  // ── Footer ───────────────────────────────────────────────────────
  const footerY = pageHeight - 20;

  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.3);
  doc.line(margin, footerY - 10, pageWidth - margin, footerY - 10);

  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.setFont('helvetica', 'normal');
  doc.text('Thank you for choosing BlackPearl!', pageWidth / 2, footerY - 2, { align: 'center' });
  doc.text('team@blackpearl.bd  |  blackpearl.bd', pageWidth / 2, footerY + 4, { align: 'center' });

  // ── Save ─────────────────────────────────────────────────────────
  doc.save(`BlackPearl-Invoice-${invoiceId}.pdf`);
}
