import { getTodayFr, getTimeFr } from "@/lib/print-utils";

interface ReceiptTemplateProps {
  sale: {
    id?: string;
    sale_number?: string;
    created_at?: string;
    payment_method?: string;
    total_amount?: number;
    discount_amount?: number;
    customer_name?: string;
    cashier_name?: string;
    employee_id?: string;
  };
  items: Array<{
    item_name: string;
    quantity: number;
    unit_price: number;
    total_price: number;
  }>;
  salon: {
    name: string;
    address: string;
    phone: string;
    whatsapp?: string;
    email?: string;
    slogan?: string;
    logo_url?: string;
    tax_number?: string;
  };
  currencyCode: string;
  format: (amount: number) => string;
  detailed?: boolean;
}

export function ReceiptTemplate({
  sale, items, salon, currencyCode, format, detailed,
}: ReceiptTemplateProps) {
  const subtotal = items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0);
  const totalDiscount = sale?.discount_amount || 0;

  return (
    <div className="w-[300px] mx-auto p-3 text-[11px] font-mono leading-tight select-none bg-white">
      {/* Header */}
      <div className="text-center mb-3 pb-3" style={{ borderBottom: "1px dashed #ccc" }}>
        {salon.logo_url && (
          <img src={salon.logo_url} alt="Logo" className="h-14 mx-auto mb-2 object-contain" />
        )}
        <h3 className="font-bold text-sm uppercase tracking-wide">{salon.name}</h3>
        {salon.slogan && (
          <p className="text-[9px] text-gray-500 italic">{salon.slogan}</p>
        )}
        <p className="whitespace-pre-wrap text-[10px] text-gray-600">{salon.address}</p>
        <p className="text-[10px] text-gray-600">Tel: {salon.phone}</p>
        {salon.whatsapp && (
          <p className="text-[10px] text-gray-600">WhatsApp: {salon.whatsapp}</p>
        )}
        {salon.tax_number && (
          <p className="text-[9px] text-gray-500">NIF: {salon.tax_number}</p>
        )}
        <div className="mt-2 pt-2" style={{ borderTop: "1px dashed #ccc" }}>
          <p className="font-bold text-[11px]">
            {detailed ? "FACTURE" : "REÇU"} #{sale?.sale_number || sale?.id?.slice(0, 8) || "N/A"}
          </p>
          <p className="text-[10px] text-gray-600">
            {sale?.created_at
              ? new Date(sale.created_at).toLocaleString("fr-FR", {
                  day: "2-digit", month: "2-digit", year: "numeric",
                  hour: "2-digit", minute: "2-digit",
                })
              : `${getTodayFr()} ${getTimeFr()}`}
          </p>
          {sale?.cashier_name && (
            <p className="text-[9px] text-gray-500">Caissier: {sale.cashier_name}</p>
          )}
        </div>
      </div>

      {/* Customer */}
      {sale?.customer_name && (
        <div className="mb-2 text-[10px] text-gray-600">
          <span className="font-medium">Client:</span> {sale.customer_name}
        </div>
      )}

      {/* Column Header */}
      <div className="flex justify-between text-[9px] text-gray-500 font-bold uppercase mb-1 pb-1" style={{ borderBottom: "1px solid #ccc" }}>
        <span className="flex-[2]">Article</span>
        <span className="w-12 text-right">Qté</span>
        <span className="w-16 text-right">Prix</span>
        <span className="w-16 text-right">Total</span>
      </div>

      {/* Items */}
      <div className="space-y-1 mb-2">
        {items.map((item, idx) => (
          <div key={idx} className="flex justify-between items-center text-[10px]">
            <span className="flex-[2] truncate pr-1">{item.item_name}</span>
            <span className="w-12 text-right text-gray-500">×{item.quantity}</span>
            <span className="w-16 text-right text-gray-500">{format(item.unit_price)}</span>
            <span className="w-16 text-right font-medium">{format(item.total_price)}</span>
          </div>
        ))}
      </div>

      {/* Separator */}
      <div className="my-2" style={{ borderTop: "1px dashed #ccc" }} />

      {/* Totals */}
      <div className="space-y-0.5">
        <div className="flex justify-between text-[10px]">
          <span className="text-gray-500">Sous-total</span>
          <span>{format(subtotal)}</span>
        </div>
        {totalDiscount > 0 && (
          <div className="flex justify-between text-[10px]">
            <span className="text-gray-500">Remise</span>
            <span className="text-red-500">-{format(totalDiscount)}</span>
          </div>
        )}
        <div className="flex justify-between font-bold text-[12px] pt-1" style={{ borderTop: "1px solid #ccc" }}>
          <span>TOTAL</span>
          <span>{format(sale?.total_amount || total)}</span>
        </div>
        <p className="text-center text-[10px] text-gray-500 uppercase pt-1">
          Paiement: {sale?.payment_method === "cash" ? "Espèces" :
                     sale?.payment_method === "moncash" ? "MonCash" :
                     sale?.payment_method === "natcash" ? "NatCash" :
                     sale?.payment_method === "card" ? "Carte" :
                     sale?.payment_method === "mixed" ? "Paiement mixte" :
                     sale?.payment_method || "Espèces"}
        </p>
      </div>

      {/* Footer */}
      <div className="text-center mt-3 pt-2" style={{ borderTop: "1px dashed #ccc" }}>
        <p className="font-medium text-[10px]">Merci de votre visite !</p>
        <p className="text-[8px] text-gray-400 mt-1">
          Document généré électroniquement
        </p>
        <p className="text-[8px] text-gray-400">{salon.name} • {getTodayFr()}</p>
      </div>
    </div>
  );
}
