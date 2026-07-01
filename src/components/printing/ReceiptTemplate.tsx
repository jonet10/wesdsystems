import React, { forwardRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { format } from 'date-fns';

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
    barberName?: string;
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
    amountTendered?: number;
    changeGiven?: number;
    balanceRemaining?: number;
  };
  currencyCode: string;
}

interface ReceiptTemplateProps {
  data: ReceiptData;
  formatAmount: (amount: number) => string;
  printerWidth?: string; // "58" | "80" | "A4" | "custom"
}

// ─── 1. TEMPLATE 58 MM (COMPACT) ───
export const Receipt58Template = ({ data, formatAmount }: { data: ReceiptData; formatAmount: (amount: number) => string }) => {
  const { business, transaction, items, totals, payment } = data;
  const qrContent = `INV:${transaction.invoiceNumber}|DATE:${format(new Date(transaction.date), 'dd/MM/yyyy')}|AMT:${totals.total}`;

  return (
    <div className="receipt-58 bg-white text-black p-2 mx-auto" style={{ width: '58mm', fontSize: '11px', fontFamily: 'monospace', lineHeight: '1.2' }}>
      <div className="text-center mb-2">
        {business.logo_url && (
          <img src={business.logo_url} alt="Logo" className="mx-auto mb-1" style={{ maxHeight: '40px', maxWidth: '100%', objectFit: 'contain' }} />
        )}
        <div className="font-bold text-sm uppercase">{business.name}</div>
        <div className="text-[9px] mt-0.5">
          {business.address && <div>{business.address}</div>}
          {business.phone && <div>Tél : {business.phone}</div>}
          {business.nif && <div>NIF : {business.nif}</div>}
        </div>
      </div>

      <div style={{ borderBottom: '1px dashed black', margin: '4px 0' }}></div>

      <div className="text-center font-bold text-xs uppercase my-1">
        REÇU
      </div>

      {/* INFO TRANSACTION */}
      <div className="text-[9px] space-y-0.5">
        <div>{transaction.invoiceLabel || "Facture"} : #{transaction.invoiceNumber}</div>
        <div>Date : {format(new Date(transaction.date), 'dd/MM/yyyy HH:mm')}</div>
        {transaction.clientName && <div>Client : {transaction.clientName}</div>}
        {transaction.barberName && <div>Barbier : {transaction.barberName}</div>}
      </div>

      <div style={{ borderBottom: '1px dashed black', margin: '4px 0' }}></div>

      {/* ARTICLES */}
      <div className="space-y-1">
        {items.map((item, idx) => (
          <div key={idx} className="text-[10px]">
            <div className="font-bold">{item.name}</div>
            <div className="flex justify-between">
              <span>{item.quantity} x {formatAmount(item.price)}</span>
              <span>{formatAmount(item.total)}</span>
            </div>
          </div>
        ))}
      </div>

      <div style={{ borderBottom: '1px dashed black', margin: '4px 0' }}></div>

      {/* TOTALS */}
      <div className="space-y-0.5 text-[10px]">
        <div className="flex justify-between">
          <span>Sous-total</span>
          <span>{formatAmount(totals.subtotal)}</span>
        </div>
        {(totals.discount || 0) > 0 && (
          <div className="flex justify-between">
            <span>Remise</span>
            <span>-{formatAmount(totals.discount!)}</span>
          </div>
        )}
        {(totals.tax || 0) > 0 && (
          <div className="flex justify-between">
            <span>Taxe</span>
            <span>{formatAmount(totals.tax!)}</span>
          </div>
        )}
        <div className="flex justify-between font-bold text-xs pt-1">
          <span>TOTAL</span>
          <span>{formatAmount(totals.total)}</span>
        </div>
      </div>

      <div style={{ borderBottom: '1px dashed black', margin: '4px 0' }}></div>

      {/* PAYMENTS */}
      <div className="text-[9px] space-y-0.5">
        <div className="flex justify-between">
          <span>Paiement : {payment.method}</span>
          <span>{formatAmount(payment.amountReceived)}</span>
        </div>
        {payment.amountTendered !== undefined && payment.amountTendered > 0 && (
          <>
            <div className="flex justify-between">
              <span>Donné</span>
              <span>{formatAmount(payment.amountTendered)}</span>
            </div>
            <div className="flex justify-between font-bold">
              <span>Rendu</span>
              <span>{formatAmount(payment.changeGiven ?? (payment.amountTendered - payment.amountReceived))}</span>
            </div>
          </>
        )}
        {payment.balanceRemaining !== undefined && payment.balanceRemaining > 0 && (
          <div className="flex justify-between text-red-600 font-bold">
            <span>Reste à payer</span>
            <span>{formatAmount(payment.balanceRemaining)}</span>
          </div>
        )}
      </div>

      <div style={{ borderBottom: '1px dashed black', margin: '4px 0' }}></div>

      <div className="text-center text-[9px] mt-2">
        <div className="font-bold">{business.receipt_footer_message || "Merci de votre visite !"}</div>
        <div className="italic mt-0.5">{business.receipt_policy_message || "Aucun remboursement après sortie."}</div>
        
        {business.show_qr_code !== false && (
          <div className="flex justify-center mt-2">
            <QRCodeSVG value={qrContent} size={45} level="L" />
          </div>
        )}
      </div>
    </div>
  );
};

// ─── 2. TEMPLATE 80 MM (STANDARD) ───
export const Receipt80Template = ({ data, formatAmount }: { data: ReceiptData; formatAmount: (amount: number) => string }) => {
  const { business, transaction, items, totals, payment } = data;
  const qrContent = `INV:${transaction.invoiceNumber}|DATE:${format(new Date(transaction.date), 'dd/MM/yyyy')}|AMT:${totals.total}`;

  return (
    <div className="receipt-80 bg-white text-black p-4 mx-auto" style={{ width: '80mm', fontSize: '13px', fontFamily: 'monospace', lineHeight: '1.3' }}>
      <div className="text-center mb-3">
        {business.logo_url && (
          <img src={business.logo_url} alt="Logo" className="mx-auto mb-2" style={{ maxHeight: '60px', maxWidth: '100%', objectFit: 'contain' }} />
        )}
        <div className="font-bold text-base uppercase">{business.name}</div>
        <div className="text-xs mt-1 space-y-0.5">
          {business.address && <div>{business.address}</div>}
          {business.phone && <div>Téléphone : {business.phone}</div>}
          {business.email && <div>Email : {business.email}</div>}
          {business.nif && <div>NIF : {business.nif}</div>}
        </div>
      </div>

      <div style={{ borderBottom: '2px dashed black', margin: '6px 0' }}></div>

      <div className="text-center font-bold text-sm uppercase my-2">
        REÇU DE PAIEMENT
      </div>

      {/* INFO TRANSACTION */}
      <div className="text-xs space-y-1">
        <div className="flex justify-between">
          <span>{transaction.invoiceLabel || "Facture"} :</span>
          <span className="font-bold">#{transaction.invoiceNumber}</span>
        </div>
        <div className="flex justify-between">
          <span>Date :</span>
          <span>{format(new Date(transaction.date), 'dd/MM/yyyy HH:mm')}</span>
        </div>
        {transaction.clientName && (
          <div className="flex justify-between">
            <span>Client :</span>
            <span className="font-bold">{transaction.clientName}</span>
          </div>
        )}
        {transaction.barberName && (
          <div className="flex justify-between">
            <span>Barbier/Coiffeur :</span>
            <span className="font-bold">{transaction.barberName}</span>
          </div>
        )}
      </div>

      <div style={{ borderBottom: '2px dashed black', margin: '6px 0' }}></div>

      {/* ARTICLES */}
      <div className="space-y-2">
        <div className="flex justify-between font-bold text-xs uppercase">
          <span>Désignation</span>
          <span>Total</span>
        </div>
        {items.map((item, idx) => (
          <div key={idx} className="text-xs">
            <div className="font-bold">{item.name}</div>
            <div className="flex justify-between text-gray-700">
              <span>{item.quantity} x {formatAmount(item.price)}</span>
              <span>{formatAmount(item.total)}</span>
            </div>
          </div>
        ))}
      </div>

      <div style={{ borderBottom: '2px dashed black', margin: '6px 0' }}></div>

      {/* TOTALS */}
      <div className="space-y-1 text-xs">
        <div className="flex justify-between">
          <span>Sous-total</span>
          <span>{formatAmount(totals.subtotal)}</span>
        </div>
        {(totals.discount || 0) > 0 && (
          <div className="flex justify-between">
            <span>Remise</span>
            <span>-{formatAmount(totals.discount!)}</span>
          </div>
        )}
        {(totals.tax || 0) > 0 && (
          <div className="flex justify-between">
            <span>Taxe</span>
            <span>{formatAmount(totals.tax!)}</span>
          </div>
        )}
        <div className="flex justify-between font-bold text-sm pt-1 border-t">
          <span>TOTAL À PAYER</span>
          <span>{formatAmount(totals.total)}</span>
        </div>
      </div>

      <div style={{ borderBottom: '2px dashed black', margin: '6px 0' }}></div>

      {/* PAYMENTS */}
      <div className="text-xs space-y-1">
        <div className="flex justify-between">
          <span>Mode de paiement :</span>
          <span className="uppercase font-bold">{payment.method}</span>
        </div>
        <div className="flex justify-between">
          <span>Montant encaissé :</span>
          <span>{formatAmount(payment.amountReceived)}</span>
        </div>
        {payment.amountTendered !== undefined && payment.amountTendered > 0 && (
          <>
            <div className="flex justify-between">
              <span>Donné :</span>
              <span>{formatAmount(payment.amountTendered)}</span>
            </div>
            <div className="flex justify-between font-bold text-green-700">
              <span>Monnaie rendue :</span>
              <span>{formatAmount(payment.changeGiven ?? (payment.amountTendered - payment.amountReceived))}</span>
            </div>
          </>
        )}
        {payment.balanceRemaining !== undefined && payment.balanceRemaining > 0 && (
          <div className="flex justify-between text-red-600 font-bold border-t pt-1">
            <span>Reste à payer :</span>
            <span>{formatAmount(payment.balanceRemaining)}</span>
          </div>
        )}
      </div>

      <div style={{ borderBottom: '2px dashed black', margin: '6px 0' }}></div>

      <div className="text-center text-xs mt-3">
        <div className="font-bold">★ {business.receipt_footer_message || "Merci de votre visite !"} ★</div>
        <div className="italic text-[10px] mt-1">{business.receipt_policy_message || "Aucun échange ni remboursement après sortie."}</div>
        
        {business.show_qr_code !== false && (
          <div className="flex justify-center mt-3">
            <QRCodeSVG value={qrContent} size={60} level="L" />
          </div>
        )}
      </div>
    </div>
  );
};

// ─── 3. TEMPLATE A4 (FACTURATION PROFESSIONNELLE) ───
export const ReceiptA4Template = ({ data, formatAmount }: { data: ReceiptData; formatAmount: (amount: number) => string }) => {
  const { business, transaction, items, totals, payment } = data;
  const qrContent = `INV:${transaction.invoiceNumber}|DATE:${format(new Date(transaction.date), 'dd/MM/yyyy')}|AMT:${totals.total}`;

  return (
    <div className="receipt-a4 bg-white text-black p-8 mx-auto" style={{ width: '210mm', minHeight: '297mm', fontSize: '14px', fontFamily: 'sans-serif', lineHeight: '1.4' }}>
      {/* HEADER */}
      <div className="flex justify-between items-start mb-8">
        <div>
          {business.logo_url && (
            <img src={business.logo_url} alt="Logo" className="mb-3" style={{ maxHeight: '80px', maxWidth: '200px', objectFit: 'contain' }} />
          )}
          <h1 className="text-2xl font-bold uppercase text-gray-800">{business.name}</h1>
          <div className="text-sm text-gray-600 mt-1 space-y-1">
            {business.address && <div>{business.address}</div>}
            {business.phone && <div>Téléphone : {business.phone}</div>}
            {business.email && <div>Email : {business.email}</div>}
            {business.nif && <div>NIF : {business.nif}</div>}
          </div>
        </div>
        <div className="text-right">
          <h2 className="text-xl font-bold text-primary uppercase">Facture</h2>
          <div className="text-sm text-gray-600 mt-1 space-y-1">
            <div>Numéro : <span className="font-bold text-black">#{transaction.invoiceNumber}</span></div>
            <div>Date : {format(new Date(transaction.date), 'dd MMMM yyyy HH:mm')}</div>
            {transaction.barberName && <div>Prestataire / Barbier : <span className="font-medium text-black">{transaction.barberName}</span></div>}
          </div>
        </div>
      </div>

      <hr className="border-gray-300 my-6" />

      {/* CLIENT INFO */}
      <div className="mb-8">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Facturé à</h3>
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="font-bold text-base">{transaction.clientName || "Client Anonyme"}</div>
          {transaction.clientPhone && <div className="text-sm text-gray-600 mt-1">Téléphone : {transaction.clientPhone}</div>}
        </div>
      </div>

      {/* TABLE */}
      <table className="w-full text-left border-collapse mb-8">
        <thead>
          <tr className="bg-gray-100 text-gray-700 uppercase text-xs font-bold border-b border-gray-300">
            <th className="py-3 px-4">Désignation</th>
            <th className="py-3 px-4 text-center">Quantité</th>
            <th className="py-3 px-4 text-right">Prix Unitaire</th>
            <th className="py-3 px-4 text-right">Montant</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => (
            <tr key={idx} className="border-b border-gray-200 text-sm">
              <td className="py-3 px-4 font-medium">{item.name}</td>
              <td className="py-3 px-4 text-center">{item.quantity}</td>
              <td className="py-3 px-4 text-right">{formatAmount(item.price)}</td>
              <td className="py-3 px-4 text-right font-semibold">{formatAmount(item.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* TOTALS AND PAYMENTS */}
      <div className="flex justify-between items-start gap-8">
        {/* Left: Payment info */}
        <div className="w-1/2 bg-gray-50 p-4 rounded-lg text-sm">
          <h4 className="font-bold text-gray-700 uppercase text-xs tracking-wider mb-2">Règlement</h4>
          <div className="space-y-1.5">
            <div className="flex justify-between">
              <span>Mode de paiement :</span>
              <span className="font-bold uppercase">{payment.method}</span>
            </div>
            <div className="flex justify-between">
              <span>Montant encaissé :</span>
              <span>{formatAmount(payment.amountReceived)}</span>
            </div>
            {payment.amountTendered !== undefined && payment.amountTendered > 0 && (
              <>
                <div className="flex justify-between">
                  <span>Montant donné :</span>
                  <span>{formatAmount(payment.amountTendered)}</span>
                </div>
                <div className="flex justify-between text-green-700 font-semibold">
                  <span>Monnaie rendue :</span>
                  <span>{formatAmount(payment.changeGiven ?? (payment.amountTendered - payment.amountReceived))}</span>
                </div>
              </>
            )}
            {payment.balanceRemaining !== undefined && payment.balanceRemaining > 0 && (
              <div className="flex justify-between text-red-600 font-bold border-t pt-1.5 mt-1.5">
                <span>Reste à payer :</span>
                <span>{formatAmount(payment.balanceRemaining)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right: Totals */}
        <div className="w-1/2 space-y-2 text-right text-sm">
          <div className="flex justify-between pl-8">
            <span className="text-gray-500">Sous-total</span>
            <span className="font-medium">{formatAmount(totals.subtotal)}</span>
          </div>
          {(totals.discount || 0) > 0 && (
            <div className="flex justify-between pl-8 text-gray-600">
              <span>Remise</span>
              <span>-{formatAmount(totals.discount!)}</span>
            </div>
          )}
          {(totals.tax || 0) > 0 && (
            <div className="flex justify-between pl-8 text-gray-600">
              <span>Taxe</span>
              <span>{formatAmount(totals.tax!)}</span>
            </div>
          )}
          <div className="flex justify-between pl-8 font-bold text-lg text-primary border-t border-gray-300 pt-2">
            <span>Total</span>
            <span>{formatAmount(totals.total)}</span>
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <div className="mt-16 text-center border-t border-gray-200 pt-6">
        <p className="font-bold text-gray-800">{business.receipt_footer_message || "Merci de votre visite !"}</p>
        <p className="text-xs text-gray-500 italic mt-1">{business.receipt_policy_message || "Aucun échange ni remboursement après sortie."}</p>
        
        {business.show_qr_code !== false && (
          <div className="flex justify-center mt-6">
            <QRCodeSVG value={qrContent} size={80} level="L" />
          </div>
        )}
      </div>
    </div>
  );
};

// ─── 4. MAIN ROUTER TEMPLATE ───
export const ReceiptTemplate = forwardRef<HTMLDivElement, ReceiptTemplateProps>(
  ({ data, formatAmount, printerWidth }, ref) => {
    // Resolve width from prop, or fallback to localStorage, defaulting to "58"
    const width = printerWidth || localStorage.getItem('wesd_pos_printer_width') || '58';

    // Cache-bust the logo_url using the stable invoice number to avoid reload loops during render
    const enrichedData = {
      ...data,
      business: {
        ...data.business,
        logo_url: data.business.logo_url ? `${data.business.logo_url}?t=${data.transaction.invoiceNumber}` : undefined
      }
    };

    const renderTemplate = () => {
      switch (width) {
        case '80':
          return <Receipt80Template data={enrichedData} formatAmount={formatAmount} />;
        case 'A4':
          return <ReceiptA4Template data={enrichedData} formatAmount={formatAmount} />;
        default:
          return <Receipt58Template data={enrichedData} formatAmount={formatAmount} />;
      }
    };

    return (
      <div ref={ref} className="receipt-print-wrapper bg-white">
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            @page { margin: 0; size: auto; }
            body { margin: 0; padding: 0; background: white; }
            .no-print { display: none !important; }
          }
        `}} />
        {renderTemplate()}
      </div>
    );
  }
);

ReceiptTemplate.displayName = 'ReceiptTemplate';
