import { z } from "zod";

export const productSchema = z.object({
  name: z.string().min(1, "Le nom est requis"),
  description: z.string().optional(),
  category_id: z.string().uuid().optional().nullable(),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  unit_price: z.coerce.number().min(0, "Le prix doit être ≥ 0"),
  cost_price: z.coerce.number().min(0, "Le coût doit être ≥ 0"),
  min_stock: z.coerce.number().min(0, "Le stock minimum doit être ≥ 0"),
  max_stock: z.coerce.number().min(0).optional().nullable(),
  location: z.string().optional(),
  notes: z.string().optional(),
  active: z.boolean().default(true),
});

export const categorySchema = z.object({
  name: z.string().min(1, "Le nom est requis"),
  description: z.string().optional(),
  sort_order: z.coerce.number().int().default(0),
});

export const brandSchema = z.object({
  name: z.string().min(1, "Le nom est requis"),
});

export const modelSchema = z.object({
  brand_id: z.string().uuid("Marque requise"),
  name: z.string().min(1, "Le nom est requis"),
  start_year: z.coerce.number().int().optional().nullable(),
  end_year: z.coerce.number().int().optional().nullable(),
});

export const compatibilitySchema = z.object({
  product_id: z.string().uuid("Produit requis"),
  brand_id: z.string().uuid().optional().nullable(),
  model_id: z.string().uuid().optional().nullable(),
  year_start: z.coerce.number().int().optional().nullable(),
  year_end: z.coerce.number().int().optional().nullable(),
  engine: z.string().optional(),
  notes: z.string().optional(),
});

export const supplierSchema = z.object({
  name: z.string().min(1, "Le nom est requis"),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().optional(),
  country: z.string().default("Haïti"),
  currency: z.string().default("HTG"),
  notes: z.string().optional(),
});

export const clientSchema = z.object({
  name: z.string().min(1, "Le nom est requis"),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().optional(),
  company: z.string().optional(),
  notes: z.string().optional(),
});

export const saleSchema = z.object({
  client_id: z.string().uuid().optional().nullable(),
  client_name: z.string().optional(),
  payment_method: z.enum(["cash", "card", "transfer", "moncash", "natcash"]),
  payment_status: z.enum(["paid", "partial", "unpaid"]).default("paid"),
  discount_type: z.enum(["percentage", "fixed", "none"]).default("none"),
  discount_value: z.coerce.number().min(0).default(0),
  tax_rate: z.coerce.number().min(0).max(100).default(0),
  notes: z.string().optional(),
  items: z.array(z.object({
    product_id: z.string().uuid().optional().nullable(),
    product_name: z.string().min(1),
    quantity: z.coerce.number().min(0.01, "Quantité > 0"),
    unit_price: z.coerce.number().min(0),
  })).min(1, "Au moins un article requis"),
});

export const purchaseSchema = z.object({
  supplier_id: z.string().uuid().optional().nullable(),
  supplier_name: z.string().optional(),
  reference_number: z.string().optional(),
  status: z.enum(["draft", "pending", "confirmed", "preparing", "shipped", "delivered", "cancelled"]).default("draft"),
  notes: z.string().optional(),
  items: z.array(z.object({
    product_id: z.string().uuid().optional().nullable(),
    product_name: z.string().min(1),
    quantity: z.coerce.number().min(0.01),
    unit_price: z.coerce.number().min(0),
  })).min(1, "Au moins un article requis"),
});

export const stockMovementSchema = z.object({
  product_id: z.string().uuid("Produit requis"),
  type: z.enum(["in", "out", "adjustment"]),
  quantity: z.coerce.number(),
  unit_price: z.coerce.number().min(0).optional().nullable(),
  reference: z.string().optional(),
  notes: z.string().optional(),
});

export type ProductFormData = z.infer<typeof productSchema>;
export type CategoryFormData = z.infer<typeof categorySchema>;
export type BrandFormData = z.infer<typeof brandSchema>;
export type ModelFormData = z.infer<typeof modelSchema>;
export type CompatibilityFormData = z.infer<typeof compatibilitySchema>;
export type SupplierFormData = z.infer<typeof supplierSchema>;
export type ClientFormData = z.infer<typeof clientSchema>;
export type SaleFormData = z.infer<typeof saleSchema>;
export type PurchaseFormData = z.infer<typeof purchaseSchema>;
export type StockMovementFormData = z.infer<typeof stockMovementSchema>;
