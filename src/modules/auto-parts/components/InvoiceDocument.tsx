import { useRef } from "react";
import { printA4 } from "@/lib/print-utils";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

interface InvoiceItem {
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface BusinessInfo {
  company_name: string;
  logo_url?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  nif?: string | null;
  patente?: string | null;
  rc?: string | null;
  bank_name?: string | null;
  bank_account?: string | null;
  receipt_footer?: string | null;
}

interface InvoiceData {
  invoice_number: string;
  created_at: string;
  client_name?: string | null;
  client?: { name: string } | null;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  discount_type: string;
  discount_value: number;
  discount_amount: number;
  total: number;
  payment_method: string;
  payment_status: string;
  notes?: string | null;
  items: InvoiceItem[];
}

export default function InvoiceDocument({ data, business }: { data: InvoiceData; business: BusinessInfo }) {
  const ref = useRef<HTMLDivElement>(null);

  const paymentLabel: Record<string, string> = {
    cash: "Espèces", card: "Carte", transfer: "Virement",
    moncash: "MonCash", natcash: "NatCash",
  };

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("fr-FR", { style: "currency", currency: "HTG", minimumFractionDigits: 2 }).format(v);

  return (
    <div>
      <div className="flex justify-end mb-4 print:hidden">
        <Button onClick={() => ref.current && printA4(ref.current, `facture-${data.invoice_number}`)}>
          <Printer className="h-4 w-4 mr-2" /> Imprimer / PDF
        </Button>
      </div>

      <div ref={ref} className="bg-white text-black p-8 max-w-[210mm] mx-auto shadow-sm" style={{ minHeight: "297mm" }}>
        {/* Header */}
        <div className="flex justify-between items-start mb-8">
          <div>
            {business.logo_url && (
              <img src={business.logo_url} alt="Logo" className="h-16 mb-2 object-contain" />
            )}
            <h1 className="text-2xl font-bold uppercase">{business.company_name || "PIÈCES AUTO"}</h1>
            {business.address && <p className="text-sm mt-1">{business.address}</p>}
            {business.phone && <p className="text-sm">Tél: {business.phone}</p>}
            {business.email && <p className="text-sm">{business.email}</p>}
            {business.nif && <p className="text-sm">NIF: {business.nif}</p>}
            {business.patente && <p className="text-sm">Patente: {business.patente}</p>}
            {business.rc && <p className="text-sm">RC: {business.rc}</p>}
          </div>
          <div className="text-right">
            <h2 className="text-xl font-bold uppercase mb-2">FACTURE</h2>
            <p className="text-sm font-medium">N° {data.invoice_number}</p>
            <p className="text-sm text-gray-600">
              {new Date(data.created_at).toLocaleDateString("fr-FR", {
                day: "2-digit", month: "long", year: "numeric",
              })}
            </p>
          </div>
        </div>

        {/* Client */}
        <div className="mb-8 p-3 border rounded">
          <p className="text-xs font-bold uppercase text-gray-500 mb-1">Client</p>
          <p className="font-medium">{data.client_name || data.client?.name || "Client divers"}</p>
        </div>

        {/* Items */}
        <table className="w-full text-sm mb-6">
          <thead>
            <tr className="border-b-2 border-black">
              <th className="text-left py-2 w-1/2">Désignation</th>
              <th className="text-right py-2 w-1/6">Qté</th>
              <th className="text-right py-2 w-1/6">P.U.</th>
              <th className="text-right py-2 w-1/6">Total</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item, i) => (
              <tr key={i} className="border-b border-gray-300">
                <td className="py-2">{item.product_name}</td>
                <td className="text-right py-2">{item.quantity}</td>
                <td className="text-right py-2">{formatCurrency(item.unit_price)}</td>
                <td className="text-right py-2 font-medium">{formatCurrency(item.total_price)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-end mb-8">
          <div className="w-64 space-y-1">
            <div className="flex justify-between text-sm">
              <span>Sous-total</span>
              <span>{formatCurrency(data.subtotal)}</span>
            </div>
            {data.discount_amount > 0 && (
              <div className="flex justify-between text-sm text-red-600">
                <span>Remise {data.discount_type === "percentage" ? `(${data.discount_value}%)` : ""}</span>
                <span>-{formatCurrency(data.discount_amount)}</span>
              </div>
            )}
            {data.tax_amount > 0 && (
              <div className="flex justify-between text-sm">
                <span>TVA ({data.tax_rate}%)</span>
                <span>{formatCurrency(data.tax_amount)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-lg border-t-2 border-black pt-1">
              <span>TOTAL</span>
              <span>{formatCurrency(data.total)}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-600 pt-1">
              <span>Paiement</span>
              <span>{paymentLabel[data.payment_method] || data.payment_method}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-600">
              <span>Statut</span>
              <span>{data.payment_status === "paid" ? "Payé" : data.payment_status === "partial" ? "Partiel" : "Impayé"}</span>
            </div>
          </div>
        </div>

        {/* Bank details */}
        {business.bank_name && (
          <div className="mb-6 text-sm text-gray-600">
            <p className="font-bold text-black mb-1">Coordonnées bancaires</p>
            <p>{business.bank_name}</p>
            {business.bank_account && <p>Compte: {business.bank_account}</p>}
          </div>
        )}

        {data.notes && (
          <div className="mb-6 text-sm">
            <p className="font-bold mb-1">Notes</p>
            <p className="text-gray-600">{data.notes}</p>
          </div>
        )}

        <div className="text-center text-sm text-gray-500 mt-auto pt-8">
          {business.receipt_footer && <p>{business.receipt_footer}</p>}
          <p className="text-xs mt-1">Document généré électroniquement - Facture N° {data.invoice_number}</p>
        </div>
      </div>
    </div>
  );
}
