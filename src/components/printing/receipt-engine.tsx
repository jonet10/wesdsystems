import React from 'react';
import { createRoot } from 'react-dom/client';
import { ReceiptTemplate, ReceiptData } from './ReceiptTemplate';

export async function printUnifiedReceipt(data: ReceiptData, formatAmount: (amount: number) => string): Promise<void> {
  try {
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      window.print();
      return;
    }

    doc.open();
    // We add tailwind CDN for the iframe so the classes work perfectly in print
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset='utf-8'>
          <script src="https://cdn.tailwindcss.com"></script>
        </head>
        <body>
          <div id="receipt-root"></div>
        </body>
      </html>
    `);
    doc.close();

    // Wait a tiny bit for the iframe body to exist and tailwind script to load
    await new Promise(r => setTimeout(r, 100));

    const rootElement = doc.getElementById('receipt-root');
    if (rootElement) {
      const root = createRoot(rootElement);
      root.render(<ReceiptTemplate data={data} formatAmount={formatAmount} />);
      
      // Wait for rendering and images/QR codes to finish
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        
        // Clean up
        setTimeout(() => {
          root.unmount();
          document.body.removeChild(iframe);
        }, 2000);
      }, 500);
    }

  } catch (error) {
    console.error("Erreur lors de l'impression du reçu unifié:", error);
  }
}
