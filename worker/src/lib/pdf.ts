/**
 * Server-side PDF generation fallback
 * Primary PDF generation happens client-side using jspdf
 * This is a placeholder for future server-side generation if needed
 */

export interface InvoiceData {
  invoiceNumber: string;
  invoiceDate: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  bookingType: string;
  dealCode: string | null;
  title: string;
  destination: string;
  travelDate: string;
  numTravelers: number;
  duration: number;
  description: string | null;
  inclusions: string[];
  exclusions: string[];
  basePrice: number;
  originalPrice: number | null;
  taxes: number;
  discounts: number;
  totalAmount: number;
  paymentStatus: string;
}

export function generateInvoiceHtml(data: InvoiceData): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; margin: 40px; color: #333; }
        .header { text-align: center; margin-bottom: 30px; }
        .header h1 { color: #0F172A; font-size: 28px; margin: 0; }
        .header p { color: #64748b; margin: 5px 0 0; }
        .invoice-info { display: flex; justify-content: space-between; margin-bottom: 30px; }
        .section { margin-bottom: 20px; }
        .section h3 { color: #0F172A; border-bottom: 2px solid #14B8A6; padding-bottom: 5px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 10px; text-align: left; border-bottom: 1px solid #e2e8f0; }
        th { background: #f8fafc; color: #0F172A; }
        .total { font-size: 18px; font-weight: bold; color: #0F172A; }
        .footer { text-align: center; margin-top: 40px; color: #64748b; }
        .badge { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 12px; }
        .badge-pending { background: #fef3c7; color: #92400e; }
        .badge-paid { background: #d1fae5; color: #065f46; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>BlackPearl</h1>
        <p>Tours & Travel Agency</p>
      </div>
      
      <div class="invoice-info">
        <div>
          <strong>Invoice #:</strong> ${data.invoiceNumber}<br>
          <strong>Date:</strong> ${data.invoiceDate}
        </div>
        <div>
          <strong>Payment Status:</strong> 
          <span class="badge badge-${data.paymentStatus === 'paid' ? 'paid' : 'pending'}">
            ${data.paymentStatus.toUpperCase()}
          </span>
        </div>
      </div>

      <div class="section">
        <h3>Customer Details</h3>
        <table>
          <tr><td><strong>Name</strong></td><td>${data.customerName}</td></tr>
          <tr><td><strong>Email</strong></td><td>${data.customerEmail}</td></tr>
          <tr><td><strong>Phone</strong></td><td>${data.customerPhone}</td></tr>
        </table>
      </div>

      <div class="section">
        <h3>Booking Details</h3>
        <table>
          <tr><td><strong>Type</strong></td><td>${data.bookingType === 'deal' ? 'Tour Deal' : 'Custom Package'}</td></tr>
          <tr><td><strong>Deal ID</strong></td><td>${data.dealCode || 'N/A'}</td></tr>
          <tr><td><strong>Title</strong></td><td>${data.title}</td></tr>
          <tr><td><strong>Destination</strong></td><td>${data.destination}</td></tr>
          <tr><td><strong>Duration</strong></td><td>${data.duration} days</td></tr>
          <tr><td><strong>Max Travelers</strong></td><td>${data.numTravelers}</td></tr>
        </table>
      </div>

      ${data.description ? `
      <div class="section">
        <h3>Tour Description</h3>
        <p>${data.description}</p>
      </div>
      ` : ''}

      ${data.inclusions && data.inclusions.length > 0 ? `
      <div class="section">
        <h3>Inclusions</h3>
        <ul style="list-style: none; padding: 0;">
          ${data.inclusions.map(item => `<li style="padding: 2px 0;">✓ ${item}</li>`).join('')}
        </ul>
      </div>
      ` : ''}

      ${data.exclusions && data.exclusions.length > 0 ? `
      <div class="section">
        <h3>Exclusions</h3>
        <ul style="list-style: none; padding: 0;">
          ${data.exclusions.map(item => `<li style="padding: 2px 0;">✗ ${item}</li>`).join('')}
        </ul>
      </div>
      ` : ''}

      <div class="section">
        <h3>Price Breakdown</h3>
        <table>
          <tr><td>Base Price</td><td>₹${data.basePrice.toLocaleString()}</td></tr>
          ${data.originalPrice && data.originalPrice > data.basePrice ? `<tr><td>Original Price</td><td>₹${data.originalPrice.toLocaleString()}</td></tr>` : ''}
          ${data.originalPrice && data.originalPrice > data.basePrice ? `<tr><td>Discount</td><td>-₹${(data.originalPrice - data.basePrice).toLocaleString()} (${Math.round((1 - data.basePrice / data.originalPrice) * 100)}% off)</td></tr>` : ''}
          ${data.taxes > 0 ? `<tr><td>Taxes</td><td>₹${data.taxes.toLocaleString()}</td></tr>` : ''}
          ${data.discounts > 0 ? `<tr><td>Discounts</td><td>-₹${data.discounts.toLocaleString()}</td></tr>` : ''}
          <tr class="total"><td>Total Amount</td><td>₹${data.totalAmount.toLocaleString()}</td></tr>
        </table>
      </div>

      <div class="footer">
        <p>Thank you for choosing BlackPearl! 🐚</p>
        <p>For queries, contact us at team@blackpearl.bd</p>
      </div>
    </body>
    </html>
  `;
}

// TODO: Email notification hooks for Resend
// export async function sendBookingConfirmationEmail(data: InvoiceData) {
//   // await resend.emails.send({...})
// }

// export async function sendStatusUpdateEmail(data: InvoiceData, newStatus: string) {
//   // await resend.emails.send({...})
// }

// export async function sendWelcomeEmail(profile: { email: string; full_name: string }) {
//   // await resend.emails.send({...})
// }
