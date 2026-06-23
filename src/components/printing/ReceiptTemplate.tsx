import React, { forwardRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export interface ReceiptItem {
  name: string;
  quantity: number;
  price: number;
  total: number;
}

export interface ReceiptData {
  business: {
    name: string;
    logo_url?: string;
    address?: string;
    phone?: string;
    email?: string;
    website?: string;
    nif?: string;
    receipt_footer_message?: string;
    receipt_policy_message?: string;
    show_qr_code?: boolean;
    show_barcode?: boolean;
  };
  transaction: {
    invoiceNumber: string;
    invoiceLabel?: string;
    date: string | Date;
    cashRegister?: string;
    cashierName?: string;
    clientName?: string;
    clientLabel?: string;
    clientPhone?: string;
  };
  items: ReceiptItem[];
  totals: {
    subtotal: number;
    tax?: number;
    discount?: number;
    total: number;
  };
  payment: {
    method: string;
    amountReceived: number;
    amountTendered?: number;   // montant donné par le client
    changeGiven?: number;      // monnaie à remettre
    balanceRemaining?: number;
  };
  currencyCode: string;
}

interface ReceiptTemplateProps {
  data: ReceiptData;
  formatAmount: (amount: number) => string;
}

export const ReceiptTemplate = forwardRef<HTMLDivElement, ReceiptTemplateProps>(
  ({ data, formatAmount }, ref) => {
    const { business, transaction, items, totals, payment } = data;

    // Build QR Code content
    const qrContent = `INV:${transaction.invoiceNumber}|DATE:${format(new Date(transaction.date), 'dd/MM/yyyy')}|AMT:${totals.total}`;

    return (
      <div ref={ref} className="receipt-container bg-white text-black p-4 mx-auto" style={{ width: '100%', maxWidth: '80mm', fontFamily: 'monospace' }}>
        {/* Custom Print Styles forced for thermal printers */}
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            @page { margin: 0; size: auto; }
            body { margin: 0; padding: 0; background: white; }
            * {
              -webkit-print-color-adjust: exact !important;
              color-adjust: exact !important;
              color: black !important;
            }
            .no-print { display: none !important; }
            /* Forcer les couleurs inverses */
            .bg-black-print { background-color: black !important; color: white !important; }
            .bg-black-print * { color: white !important; }
          }
          .receipt-text-normal { font-size: 14px; line-height: 1.2; }
          .receipt-text-sub { font-size: 16px; font-weight: bold; }
          .receipt-text-title { font-size: 24px; font-weight: 900; }
          .receipt-text-huge { font-size: 28px; font-weight: 900; }
          .receipt-divider { border-bottom: 2px dashed black; margin: 12px 0; }
          .receipt-divider-solid { border-bottom: 3px solid black; margin: 12px 0; }
        `}} />

        {/* HEADER */}
        <div className="text-center mb-4">
          {business.logo_url && (
            <img src={business.logo_url} alt="Logo" className="mx-auto mb-2" style={{ maxHeight: '80px', maxWidth: '100%', objectFit: 'contain' }} />
          )}
          <div className="receipt-text-title uppercase">{business.name}</div>
          
          <div className="mt-2 receipt-text-normal">
            {business.address && <div>{business.address}</div>}
            <div className="mt-1">
              {business.phone && <span>Tél : {business.phone}</span>}
              {business.phone && business.email && <span> | </span>}
              {business.email && <span>Email : {business.email}</span>}
            </div>
            {business.nif && <div>NIF : {business.nif}</div>}
            {business.website && <div>{business.website}</div>}
          </div>
        </div>

        <div className="receipt-divider-solid"></div>

        {/* TITLE */}
        <div className="text-center receipt-text-title uppercase mb-4">
          REÇU DE PAIEMENT
        </div>

        {/* TRANSACTION INFO */}
        <div className="flex flex-col gap-1 receipt-text-sub text-center mb-4 font-bold">
          <div>
            <span>{transaction.invoiceLabel || "Facture"} : </span>
            <span>#{transaction.invoiceNumber}</span>
          </div>
          {transaction.clientName && (
            <div>
              <span>{transaction.clientLabel || "Client"} : </span>
              <span>{transaction.clientName}</span>
            </div>
          )}
          {transaction.clientPhone && (
            <div>
              <span>Tél : </span>
              <span>{transaction.clientPhone}</span>
            </div>
          )}
        </div>

        {/* TABLE */}
        <div className="w-full">
          <div className="flex bg-black-print text-white font-bold receipt-text-normal p-1 px-2 uppercase">
            <div className="w-full">ARTICLE</div>
          </div>
          
          <div className="mt-2 space-y-3">
            {items.map((item, idx) => (
              <div key={idx} className="flex flex-col receipt-text-normal px-2">
                <div className="font-bold break-words">{item.name}</div>
                <div className="flex justify-between w-full mt-1">
                  <div>{item.quantity} x {formatAmount(item.price)}</div>
                  <div className="font-bold">{formatAmount(item.total)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="receipt-divider mt-4"></div>

        {/* SUBTOTALS */}
        <div className="space-y-1 px-2 receipt-text-sub uppercase">
          <div className="flex justify-between">
            <span>SOUS-TOTAL</span>
            <span>{formatAmount(totals.subtotal)}</span>
          </div>
          {(totals.tax || 0) > 0 && (
            <div className="flex justify-between">
              <span>TAXE</span>
              <span>{formatAmount(totals.tax!)}</span>
            </div>
          )}
          {(totals.discount || 0) > 0 && (
            <div className="flex justify-between">
              <span>REMISE</span>
              <span>-{formatAmount(totals.discount!)}</span>
            </div>
          )}
        </div>

        <div className="receipt-divider"></div>

        {/* TOTAL */}
        <div className="flex justify-between items-center px-2 receipt-text-huge uppercase">
          <span>TOTAL</span>
          <span>{formatAmount(totals.total)}</span>
        </div>

        <div className="receipt-divider"></div>

        {/* PAYMENT METHOD */}
        <div className="border-2 border-black rounded-lg mt-4 flex flex-col overflow-hidden">
          <div className="flex items-stretch border-b-2 border-black">
            <div className="w-1/2 p-2 text-center border-r-2 border-black flex flex-col justify-center bg-gray-50">
              <div className="text-[10px] uppercase font-bold text-gray-600 mb-1">MODE DE PAIEMENT</div>
              <div className="receipt-text-sub uppercase">{payment.method}</div>
            </div>
            <div className="w-1/2 p-2 text-center flex flex-col justify-center">
              <div className="text-[10px] uppercase font-bold text-gray-600 mb-1">TOTAL À PAYER</div>
              <div className="receipt-text-sub font-bold">{formatAmount(payment.amountReceived)}</div>
            </div>
          </div>
          {payment.amountTendered !== undefined && payment.amountTendered > 0 && (
            <div className="flex items-stretch border-t-2 border-black">
              <div className="w-1/2 p-2 text-center border-r-2 border-black flex flex-col justify-center bg-gray-50">
                <div className="text-[10px] uppercase font-bold text-gray-600 mb-1">MONTANT DONNÉ</div>
                <div className="receipt-text-sub font-bold">{formatAmount(payment.amountTendered)}</div>
              </div>
              <div className="w-1/2 p-2 text-center flex flex-col justify-center bg-green-50">
                <div className="text-[10px] uppercase font-bold text-green-700 mb-1">MONNAIE RENDUE</div>
                <div className="receipt-text-sub font-bold" style={{ color: '#16a34a' }}>
                  {formatAmount(payment.changeGiven ?? Math.max(0, payment.amountTendered - payment.amountReceived))}
                </div>
              </div>
            </div>
          )}
          {payment.balanceRemaining !== undefined && payment.balanceRemaining > 0 && (
            <div className="p-2 text-center flex flex-col justify-center bg-red-50 border-t-2 border-black">
              <div className="text-[10px] uppercase font-bold text-red-600 mb-1">RESTE À PAYER</div>
              <div className="receipt-text-sub font-bold text-red-600">{formatAmount(payment.balanceRemaining)}</div>
            </div>
          )}
        </div>

        {/* FOOTER STARS */}
        <div className="mt-6 text-center">
          <div className="receipt-text-sub flex items-center justify-center gap-2 mb-2">
            <span>★</span>
            <span>{business.receipt_footer_message || "Merci de votre visite !"}</span>
            <span>★</span>
          </div>
          <div className="text-xs italic text-gray-800">
            {business.receipt_policy_message || "Aucun échange ni remboursement après sortie du magasin."}
          </div>
        </div>

        <div className="receipt-divider mt-4"></div>

        {/* BOTTOM SECTION */}
        <div className="flex justify-between items-end mt-4 text-[10px] text-gray-600">
          <div className="w-16">
            {(business.show_qr_code !== false) && (
              <QRCodeSVG value={qrContent} size={60} level="L" includeMargin={false} />
            )}
          </div>
          <div className="text-center flex-1 px-2">
            <div className="font-bold">Document généré électroniquement</div>
            <div className="mt-1">WesdSystems - wesdsystems.store</div>
          </div>
          <div className="text-right">
            <div>Imprimé le : {format(new Date(), 'dd/MM/yyyy HH:mm')}</div>
            {transaction.cashierName && <div>Par : {transaction.cashierName}</div>}
          </div>
        </div>
      </div>
    );
  }
);

ReceiptTemplate.displayName = 'ReceiptTemplate';
