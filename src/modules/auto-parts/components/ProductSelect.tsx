import { useState, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { searchProducts } from "../services/products";
import { useAutoPartsBusinessId } from "../hooks/useAutoPartsBusinessId";

interface ProductSelectProps {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function ProductSelect({ value, onChange, placeholder = "Sélectionner un produit" }: ProductSelectProps) {
  const businessId = useAutoPartsBusinessId();
  const [products, setProducts] = useState<{ id: string; name: string; sku: string | null }[]>([]);

  useEffect(() => {
    if (!businessId) return;
    searchProducts(businessId, "").then(setProducts).catch(console.error);
  }, [businessId]);

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {products.map((p) => (
          <SelectItem key={p.id} value={p.id}>
            {p.name}{p.sku ? ` (${p.sku})` : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
