import { useRef } from "react";
import { printA4 } from "@/lib/print-utils";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

interface DNItem {
  product_name: string;
  quantity: number;
  unit?: string;
}

interface BusinessInfo {
  company_name: string;
  logo_url?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  nif?: string | null;
}

interface DNData {
  delivery_note_number: string;
  created_at: string;
  delivered_at?: string | null;
  client_name?: string | null;
  client_phone?: string | null;
  client_address?: string | null;
  status: string;
  notes?: string | null;
  items: DNItem[];
}

const statusLabel: Record<string, string> = {
  draft: "Brouillon", delivered: "Livré", cancelled: "Annulé",
};

export default function DeliveryNoteDocument({ data, business }: { data: DNData; business: BusinessInfo }) {
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div>
      <div className="flex justify-end mb-4 print:hidden">
        <Button onClick={() => ref.current && printA4(ref.current, `bl-${data.delivery_note_number}`)}>
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
          </div>
          <div className="text-right">
            <h2 className="text-xl font-bold uppercase mb-2">BON DE LIVRAISON</h2>
            <p className="text-sm font-medium">N° {data.delivery_note_number}</p>
            <p className="text-sm text-gray-600">
              {new Date(data.created_at).toLocaleDateString("fr-FR", {
                day: "2-digit", month: "long", year: "numeric",
              })}
            </p>
            {data.delivered_at && (
              <p className="text-sm text-gray-600 mt-1">
                Livré le: {new Date(data.delivered_at).toLocaleDateString("fr-FR")}
              </p>
            )}
            <p className="text-sm font-semibold mt-1">{statusLabel[data.status] || data.status}</p>
          </div>
        </div>

        {/* Client */}
        <div className="mb-8 p-3 border rounded">
          <p className="text-xs font-bold uppercase text-gray-500 mb-1">Client</p>
          <p className="font-medium">{data.client_name || "Client divers"}</p>
          {data.client_phone && <p className="text-sm text-gray-600">Tél: {data.client_phone}</p>}
          {data.client_address && <p className="text-sm text-gray-600">{data.client_address}</p>}
        </div>

        {/* Items */}
        <table className="w-full text-sm mb-8">
          <thead>
            <tr className="border-b-2 border-black">
              <th className="text-left py-2 w-2/3">Désignation</th>
              <th className="text-center py-2 w-1/6">Qté</th>
              <th className="text-center py-2 w-1/6">Unité</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item, i) => (
              <tr key={i} className="border-b border-gray-300">
                <td className="py-2">{item.product_name}</td>
                <td className="text-center py-2">{item.quantity}</td>
                <td className="text-center py-2">{item.unit || "pce"}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Signature area */}
        <div className="mt-16 grid grid-cols-2 gap-8 text-sm">
          <div className="border-t border-black pt-2 text-center">
            <p className="font-medium">Signature du client</p>
          </div>
          <div className="border-t border-black pt-2 text-center">
            <p className="font-medium">Cachet et signature</p>
          </div>
        </div>

        {data.notes && (
          <div className="mt-6 text-sm">
            <p className="font-bold mb-1">Notes</p>
            <p className="text-gray-600 whitespace-pre-line">{data.notes}</p>
          </div>
        )}

        <div className="text-center text-sm text-gray-500 mt-16">
          <p className="text-xs">Document généré électroniquement - BL N° {data.delivery_note_number}</p>
        </div>
      </div>
    </div>
  );
}
