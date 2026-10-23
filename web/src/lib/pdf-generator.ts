import jsPDF from 'jspdf';
import { Canvg } from 'canvg';
import { humanizeDashes } from './text';
import type { Booking } from '../types';

// Monochrome palette only.
const INK: [number, number, number] = [20, 25, 35];
const MUTED: [number, number, number] = [90, 100, 112];
const RULE: [number, number, number] = [150, 160, 172];

function formatBDT(amount: number): string {
  return `BDT ${amount.toLocaleString('en-BD')}`;
}

// Cached rasterized logo so repeat downloads don't re-fetch and re-render it.
let watermarkCache: string | null = null;

/**
 * Renders `/logo.svg` (the BlackPearl ship mark) to a faint monochrome PNG
 * data URL for use as a page watermark.
 *
 * The SVG uses `fill="currentColor"`, so the color is pinned to ink before
 * rendering. canvg wipes its canvas before drawing (which destroyed the
 * white base and left transparency that flattened to black), so the logo is
 * rendered to a throwaway canvas first and then composited at 8% alpha over
 * an opaque white tile. The opaque PNG keeps the tile monochrome, seamless
 * on the white page, and free of any alpha channel jsPDF could misread as
 * black. Returns null when the logo can't be loaded; callers then skip the
 * watermark instead of failing the whole invoice.
 */
async function loadWatermark(): Promise<string | null> {
  if (watermarkCache) return watermarkCache;
  try {
    const res = await fetch('/logo.svg');
    if (!res.ok) return null;
    const svg = (await res.text()).split('currentColor').join('#141923');

    // Throwaway canvas: canvg may clear this, which is fine here.
    const scratch = document.createElement('canvas');
    scratch.width = 368;
    scratch.height = 536;
    const sctx = scratch.getContext('2d');
    if (!sctx) return null;
    await (await Canvg.from(sctx, svg)).render();

    // Downscaled opaque tile: a faint background mark needs no more.
    const tileWidth = 256;
    const tileHeight = Math.round((tileWidth * 536) / 368);
    const canvas = document.createElement('canvas');
    canvas.width = tileWidth;
    canvas.height = tileHeight;
    // No alpha channel: the PNG stays opaque RGB, which keeps it small and
    // gives jsPDF nothing transparent to misread as black.
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return null;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = 0.08;
    ctx.drawImage(scratch, 0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = 1;

    watermarkCache = canvas.toDataURL('image/png');
    return watermarkCache;
  } catch {
    return null;
  }
}

/**
 * Compact monochrome invoice for deal bookings.
 *
 * Contents are intentionally limited to:
 *  - Invoice ID
 *  - Slug URL
 *  - Deal ID
 *  - Destination
 *  - Category
 *  - Duration
 *  - Price
 *
 * Price is taken from the booking's `total_amount`, not the deal's stored
 * price, so the invoice always matches what the booking actually charged.
 */
export async function generateInvoicePDF(booking: Booking): Promise<void> {
  const deal = booking.deal;

  // Only deal bookings match the requested invoice layout.
  if (!deal) {
    throw new Error('generateInvoicePDF: deal booking required');
  }

  const price = booking.total_amount;

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 24;
  const contentWidth = pageWidth - margin * 2;

  // Watermark: faint ship mark centered behind everything else.
  const watermark = await loadWatermark();
  if (watermark) {
    const wmWidth = 75;
    const wmHeight = (wmWidth * 536) / 368;
    // SLOW = strongest Flate compression: the tile is nearly all white, so
    // it deflates to almost nothing instead of embedding raw pixels.
    doc.addImage(
      watermark,
      'PNG',
      (pageWidth - wmWidth) / 2,
      (pageHeight - wmHeight) / 2,
      wmWidth,
      wmHeight,
      undefined,
      'SLOW',
    );
  }

  // Top rule
  doc.setFillColor(...INK);
  doc.rect(0, 0, pageWidth, 4, 'F');

  let y = 26;

  // Title block
  doc.setFontSize(22);
  doc.setTextColor(...INK);
  doc.setFont('helvetica', 'bold');
  doc.text('INVOICE', margin, y);

  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.setFont('helvetica', 'normal');
  doc.text('BlackPearl Tours & Travel', margin, y + 6);

  // Invoice ID on the right
  const invoiceId = booking.invoice_number || deal.deal_code || booking.id;
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text('Invoice No.', pageWidth - margin, y, { align: 'right' });
  doc.setFontSize(11);
  doc.setTextColor(...INK);
  doc.setFont('helvetica', 'bold');
  doc.text(invoiceId, pageWidth - margin, y + 5, { align: 'right' });

  y += 22;

  // Thin separator
  doc.setDrawColor(...RULE);
  doc.setLineWidth(0.4);
  doc.line(margin, y, pageWidth - margin, y);
  y += 12;

  // Slug URL
  const slugUrl = `https://blackpearlbd.pages.dev/deals/${deal.slug}`;

  doc.setTextColor(...MUTED);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Deal URL', margin, y);
  doc.setFontSize(9);
  doc.setTextColor(...INK);
  doc.setFont('helvetica', 'normal');
  const urlLines = doc.splitTextToSize(slugUrl, contentWidth);
  doc.text(urlLines, margin, y + 5);
  y += urlLines.length * 4.5 + 8;

  // Details table
  const rows: Array<[string, string]> = [
    ['Deal ID', deal.id],
    ['Destination', humanizeDashes(deal.destination || '') || 'Not set'],
    ['Category', humanizeDashes(deal.category || '') || 'Not set'],
    ['Duration', `${deal.duration_days} day${deal.duration_days === 1 ? '' : 's'}`],
    ['Price', formatBDT(price)],
  ];

  doc.setDrawColor(...RULE);
  doc.setLineWidth(0.4);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  const rowHeight = 7;
  const labelWidth = 42;

  for (const [label, value] of rows) {
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.setFont('helvetica', 'normal');
    doc.text(label.toUpperCase(), margin, y);

    doc.setTextColor(...INK);
    doc.setFont('helvetica', 'bold');
    const valueX = margin + labelWidth;
    doc.text(String(value), valueX, y);

    if (label === 'Price') {
      doc.text(formatBDT(price), pageWidth - margin, y, { align: 'right' });
    }

    y += rowHeight;
  }

  // Bottom rule
  y += 6;
  doc.setDrawColor(...RULE);
  doc.setLineWidth(0.4);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  // Footer note
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.setFont('helvetica', 'normal');
  doc.text('BlackPearl Tours & Travel', margin, pageHeight - 16);
  doc.text('Generated from deal booking', pageWidth - margin, pageHeight - 16, { align: 'right' });

  doc.save(`BlackPearl-Invoice-${invoiceId}.pdf`);
}
