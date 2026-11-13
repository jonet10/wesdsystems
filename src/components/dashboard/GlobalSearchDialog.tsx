import { useEffect, useState, useTransition } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  LayoutDashboard,
  ShoppingCart,
  Pill,
  Tags,
  Boxes,
  Truck,
  ShoppingBag,
  ArrowLeftRight,
  Users,
  FileText,
  CreditCard,
  Monitor,
  UserCheck,
  BarChart3,
  Settings,
  MessageSquare,
  Package,
  Search,
  Loader2,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { usePharmacyBusinessId } from "@/modules/pharmacy/hooks/usePharmacyBusinessId";
import { useCurrency } from "@/contexts/CurrencyContext";

interface GlobalSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GlobalSearchDialog({ open, onOpenChange }: GlobalSearchDialogProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const businessId = usePharmacyBusinessId();
  const { format } = useCurrency();

  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);

  const isPharmacy = location.pathname.startsWith("/pharmacie");

  // Raccourci clavier global ⌘K / Ctrl+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [open, onOpenChange]);

  // Recherche dynamique dès que query change
  useEffect(() => {
    if (!open) {
      setQuery("");
      setProducts([]);
      setCustomers([]);
      return;
    }

    const trimmed = query.trim();
    if (trimmed.length < 2 || !businessId) {
      setProducts([]);
      setCustomers([]);
      return;
    }

    let active = true;
    setSearching(true);

    const timer = setTimeout(async () => {
      try {
        const [prodRes, custRes] = await Promise.all([
          supabase
            .from("pharmacy_products")
            .select("id, name, generic_name, sale_price, total_stock_quantity, barcode")
            .eq("business_id", businessId)
            .or(`name.ilike.%${trimmed}%,generic_name.ilike.%${trimmed}%,barcode.ilike.%${trimmed}%`)
            .limit(6),
          supabase
            .from("pharmacy_customers")
            .select("id, first_name, last_name, phone")
            .eq("business_id", businessId)
            .or(`first_name.ilike.%${trimmed}%,last_name.ilike.%${trimmed}%,phone.ilike.%${trimmed}%`)
            .limit(4),
        ]);

        if (active) {
          setProducts(prodRes.data || []);
          setCustomers(custRes.data || []);
        }
      } catch (err) {
        console.error("Search error:", err);
      } finally {
        if (active) setSearching(false);
      }
    }, 200);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, open, businessId]);

  const handleSelect = (url: string) => {
    onOpenChange(false);
    navigate(url);
  };

  const pharmacyPages = [
    { title: "Tableau de bord", url: "/pharmacie", icon: LayoutDashboard, keywords: ["stats", "chiffre", "accueil", "dashboard"] },
    { title: "Caisse & Point de Vente (POS)", url: "/pharmacie/pos", icon: ShoppingCart, keywords: ["vente", "encaisser", "facture", "panier", "pos"] },
    { title: "Médicaments & Produits", url: "/pharmacie/products", icon: Pill, keywords: ["médicament", "produit", "catalogue", "stock", "dci"] },
    { title: "Catégories de médicaments", url: "/pharmacie/categories", icon: Tags, keywords: ["catégorie", "classe", "famille"] },
    { title: "Lots & Péremptions", url: "/pharmacie/batches", icon: Boxes, keywords: ["lots", "péremption", "expiration", "batch", "fefo"] },
    { title: "Fournisseurs", url: "/pharmacie/suppliers", icon: Truck, keywords: ["fournisseur", "grossiste", "labo"] },
    { title: "Achats & Réceptions", url: "/pharmacie/purchases", icon: ShoppingBag, keywords: ["achat", "commande", "bon de commande", "facture fournisseur"] },
    { title: "Stock & Mouvements", url: "/pharmacie/stock", icon: ArrowLeftRight, keywords: ["stock", "mouvement", "ajustement", "inventaire"] },
    { title: "Patients & Clients", url: "/pharmacie/patients", icon: Users, keywords: ["patient", "client", "dossier"] },
    { title: "Ordonnances Médicales", url: "/pharmacie/prescriptions", icon: FileText, keywords: ["ordonnance", "prescription", "médecin"] },
    { title: "Crédits Clients", url: "/pharmacie/credits", icon: CreditCard, keywords: ["crédit", "dette", "avance", "solde"] },
    { title: "Caisses Enregistreuses", url: "/pharmacie/registers", icon: Monitor, keywords: ["caisse", "tiroir", "clôture", "fond de caisse"] },
    { title: "Employés & Caissiers", url: "/pharmacie/employees", icon: UserCheck, keywords: ["employé", "caissier", "staff", "équipe", "accès"] },
    { title: "Rapports & Statistiques", url: "/pharmacie/reports", icon: BarChart3, keywords: ["rapport", "statistique", "pdf", "excel", "bilan"] },
    { title: "Alertes WhatsApp", url: "/pharmacie/whatsapp-settings", icon: MessageSquare, keywords: ["whatsapp", "sms", "alerte", "message"] },
    { title: "Paramètres de la pharmacie", url: "/pharmacie/settings", icon: Settings, keywords: ["paramètre", "configuration", "devise", "taux"] },
  ];

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Rechercher une page, un médicament, un patient..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList className="max-h-[380px]">
        {searching && (
          <div className="flex items-center justify-center p-4 text-xs text-muted-foreground gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            Recherche en cours...
          </div>
        )}

        <CommandEmpty>Aucun résultat trouvé pour « {query} ».</CommandEmpty>

        {/* Résultats Dynamiques : Médicaments en stock */}
        {products.length > 0 && (
          <CommandGroup heading="Médicaments & Produits trouvés">
            {products.map((p) => {
              const stock = Number(p.total_stock_quantity || 0);
              return (
                <CommandItem
                  key={p.id}
                  value={`${p.name} ${p.generic_name || ""} ${p.barcode || ""}`}
                  onSelect={() => handleSelect("/pharmacie/products")}
                  className="flex items-center justify-between py-2 cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <Pill className="h-4 w-4 text-primary shrink-0" />
                    <div>
                      <p className="font-semibold text-sm leading-tight text-foreground">{p.name}</p>
                      {p.generic_name && (
                        <p className="text-xs text-muted-foreground">{p.generic_name}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs text-primary">{format(Number(p.sale_price || 0))}</span>
                    {stock > 0 ? (
                      <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">
                        Stock: {stock}
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="text-[10px]">
                        Rupture
                      </Badge>
                    )}
                  </div>
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}

        {/* Résultats Dynamiques : Patients */}
        {customers.length > 0 && (
          <CommandGroup heading="Patients">
            {customers.map((c) => (
              <CommandItem
                key={c.id}
                value={`${c.first_name || ""} ${c.last_name || ""} ${c.phone || ""}`}
                onSelect={() => handleSelect("/pharmacie/patients")}
                className="flex items-center justify-between py-2 cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <Users className="h-4 w-4 text-blue-500 shrink-0" />
                  <div>
                    <p className="font-semibold text-sm leading-tight text-foreground">
                      {c.first_name} {c.last_name}
                    </p>
                    {c.phone && <p className="text-xs text-muted-foreground">📞 {c.phone}</p>}
                  </div>
                </div>
                <Badge variant="secondary" className="text-[10px]">
                  Fiche patient
                </Badge>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {(products.length > 0 || customers.length > 0) && <CommandSeparator />}

        {/* Pages et Navigation Rapide */}
        {isPharmacy && (
          <CommandGroup heading="Navigation Pharmacie">
            {pharmacyPages.map((page) => {
              const Icon = page.icon;
              return (
                <CommandItem
                  key={page.url}
                  value={`${page.title} ${page.keywords.join(" ")}`}
                  onSelect={() => handleSelect(page.url)}
                  className="flex items-center gap-2.5 py-2 cursor-pointer"
                >
                  <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm font-medium">{page.title}</span>
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
