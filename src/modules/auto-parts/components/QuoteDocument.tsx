import { useRef } from "react";
import { printA4 } from "@/lib/print-utils";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

interface QuoteItem {
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
}

interface QuoteData {
  quote_number: string;
  created_at: string;
  valid_until?: string | null;
  client_name?: string | null;
  client_phone?: string | null;
  client_email?: string | null;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  discount_type: string;
  discount_value: number;
  discount_amount: number;
  total: number;
  status: string;
  notes?: string | null;
  terms?: string | null;
  items: QuoteItem[];
}

const fmt = (v: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "HTG", minimumFractionDigits: 2 }).format(v);

const statusLabel: Record<string, { label: string; color: string }> = {
  draft: { label: "Brouillon", color: "text-gray-500" },
  sent: { label: "Envoyé", color: "text-blue-600" },
  accepted: { label: "Accepté", color: "text-green-600" },
  refused: { label: "Refusé", color: "text-red-600" },
  converted: { label: "Converti en facture", color: "text-green-700" },
  expired: { label: "Expiré", color: "text-red-400" },
};

export default function QuoteDocument({ data, business }: { data: QuoteData; business: BusinessInfo }) {
  const ref = useRef<HTMLDivElement>(null);
  const status = statusLabel[data.status] || { label: data.status, color: "text-gray-500" };

  return (
    <div>
      <div className="flex justify-end mb-4 print:hidden">
        <Button onClick={() => ref.current && printA4(ref.current, `devis-${data.quote_number}`)}>
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
            <h2 className="text-xl font-bold uppercase mb-2">DEVIS</h2>
            <p className="text-sm font-medium">N° {data.quote_number}</p>
            <p className="text-sm text-gray-600">
              {new Date(data.created_at).toLocaleDateString("fr-FR", {
                day: "2-digit", month: "long", year: "numeric",
              })}
            </p>
            {data.valid_until && (
              <p className="text-sm text-gray-500 mt-1">
                Valable jusqu'au {new Date(data.valid_until).toLocaleDateString("fr-FR")}
              </p>
            )}
            <p className={`text-sm font-semibold mt-1 ${status.color}`}>{status.label}</p>
          </div>
        </div>

        {/* Client */}
        <div className="mb-8 p-3 border rounded">
          <p className="text-xs font-bold uppercase text-gray-500 mb-1">Client</p>
          <p className="font-medium">{data.client_name || "Client divers"}</p>
          {data.client_phone && <p className="text-sm text-gray-600">Tél: {data.client_phone}</p>}
          {data.client_email && <p className="text-sm text-gray-600">{data.client_email}</p>}
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
                <td className="text-right py-2">{fmt(item.unit_price)}</td>
                <td className="text-right py-2 font-medium">{fmt(item.total_price)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-end mb-8">
          <div className="w-64 space-y-1">
            <div className="flex justify-between text-sm">
              <span>Sous-total</span>
              <span>{fmt(data.subtotal)}</span>
            </div>
            {data.discount_amount > 0 && (
              <div className="flex justify-between text-sm text-red-600">
                <span>Remise {data.discount_type === "percentage" ? `(${data.discount_value}%)` : ""}</span>
                <span>-{fmt(data.discount_amount)}</span>
              </div>
            )}
            {data.tax_amount > 0 && (
              <div className="flex justify-between text-sm">
                <span>TVA ({data.tax_rate}%)</span>
                <span>{fmt(data.tax_amount)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-lg border-t-2 border-black pt-1">
              <span>TOTAL</span>
              <span>{fmt(data.total)}</span>
            </div>
          </div>
        </div>

        {/* Terms */}
        {data.terms && (
          <div className="mb-6 text-sm">
            <p className="font-bold mb-1">Conditions</p>
            <p className="text-gray-600 whitespace-pre-line">{data.terms}</p>
          </div>
        )}

        {data.notes && (
          <div className="mb-6 text-sm">
            <p className="font-bold mb-1">Notes</p>
            <p className="text-gray-600 whitespace-pre-line">{data.notes}</p>
          </div>
        )}

        <div className="text-center text-sm text-gray-500 mt-auto pt-8">
          <p className="text-xs">Document généré électroniquement - Devis N° {data.quote_number}</p>
        </div>
      </div>
    </div>
  );
}
