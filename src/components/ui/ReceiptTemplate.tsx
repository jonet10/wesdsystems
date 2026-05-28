/**
 * Template de reçu thermique 80mm pour impression PDF
 * Optimisé pour html2canvas + jsPDF
 * Fichier: src/components/ui/ReceiptTemplate.tsx
 */

interface ReceiptTemplateProps {
  sale: {
    id?: string;
    sale_number?: string;
    created_at?: string;
    payment_method?: string;
    total_amount?: number;
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
    logo_url?: string;
  };
  currencyCode: string;
  format: (amount: number) => string;
}

export function ReceiptTemplate({ sale, items, salon, currencyCode, format }: ReceiptTemplateProps) {
  return (
    <div className="w-[300px] mx-auto p-3 text-[11px] font-mono leading-tight select-none">
      {/* Header */}
      <div className="text-center mb-3 border-b border-dashed pb-3">
        {salon.logo_url && (
          <img src={salon.logo_url} alt="Logo" className="h-10 mx-auto mb-2 object-contain" />
        )}
        <h3 className="font-bold text-sm uppercase">{salon.name}</h3>
        <p className="whitespace-pre-wrap text-[10px]">{salon.address}</p>
        <p className="text-[10px]">Tel: {salon.phone}</p>
        <p className="mt-1 font-medium text-[10px]">
          Reçu #{sale?.sale_number || sale?.id?.slice(0, 8) || "N/A"}
        </p>
        <p className="text-[10px]">
          {sale?.created_at 
            ? new Date(sale.created_at).toLocaleString('fr-HT', {
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
              })
            : new Date().toLocaleString('fr-HT')
          }
        </p>
      </div>

      {/* Items List */}
      <div className="space-y-1 mb-3">
        {items.map((item, idx) => (
          <div key={idx} className="flex justify-between items-center">
            <span className="truncate pr-2 text-[10px]">
              {item.item_name} <span className="text-muted-foreground">×{item.quantity}</span>
            </span>
            <span className="whitespace-nowrap font-medium text-[10px]">
              {format(item.total_price)}
            </span>
          </div>
        ))}
      </div>

      {/* Separator */}
      <div className="border-t border-dashed my-2" />

      {/* Totals */}
      <div className="space-y-1">
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground text-[10px]">Sous-total</span>
          <span className="text-[10px]">{format(items.reduce((sum, i) => sum + i.total_price, 0))}</span>
        </div>
        <div className="flex justify-between items-center font-bold text-sm pt-1 border-t border-dashed">
          <span>TOTAL</span>
          <span>{format(sale?.total_amount || 0)}</span>
        </div>
        <p className="text-center mt-2 text-[10px] uppercase">
          Paiement: {sale?.payment_method || "Espèces"}
        </p>
      </div>

      {/* Footer */}
      <div className="text-center mt-4 pt-2 border-t border-dashed">
        <p className="font-medium text-[10px]">Merci de votre visite !</p>
        <p className="text-[8px] text-muted-foreground mt-1">
          Document généré électroniquement • WesdSystems
        </p>
        <p className="text-[8px] text-muted-foreground">
          {new Date().getFullYear()} © Tous droits réservés
        </p>
      </div>
    </div>
  );
}