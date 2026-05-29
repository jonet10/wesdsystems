import { z } from "zod";

export const serviceSchema = z.object({
  name: z.string().min(2, "Nom requis (min. 2 caractères)"),
  category_id: z.string().optional(),
  description: z.string().optional(),
  duration_minutes: z.coerce.number().min(5, "Minimum 5 minutes").max(480, "Maximum 8 heures"),
  price_htg: z.coerce.number().min(0, "Prix requis"),
  commission_percentage: z.coerce.number().min(0).max(100).default(0),
  requires_employee: z.boolean().default(true),
});

export const productSchema = z.object({
  name: z.string().min(2, "Nom requis"),
  category: z.string().optional(),
  description: z.string().optional(),
  unit_price: z.coerce.number().min(0, "Prix requis"),
  cost_price: z.coerce.number().min(0).optional(),
  quantity_in_stock: z.coerce.number().int().min(0).default(0),
  reorder_level: z.coerce.number().int().min(0).default(10),
  sku: z.string().optional(),
  barcode: z.string().optional(),
});

export const beverageSchema = z.object({
  name: z.string().min(2, "Nom requis"),
  brand: z.string().optional(),
  description: z.string().optional(),
  unit_price: z.coerce.number().min(0, "Prix unitaire requis"),
  cost_price: z.coerce.number().min(0).optional(),
  units_per_case: z.coerce.number().int().min(1, "1 unité par caisse minimum").default(24),
  stock_cases: z.coerce.number().int().min(0).default(0),
  stock_units: z.coerce.number().int().min(0).default(0),
  reorder_level_units: z.coerce.number().int().min(0).default(50),
  sku: z.string().optional(),
  barcode: z.string().optional(),
});

export const expenseSchema = z.object({
  category: z.string().min(1, "Catégorie requise"),
  description: z.string().min(2, "Description requise"),
  amount: z.coerce.number().min(0, "Montant requis"),
  payment_method: z.string().default("cash"),
});

export const promotionSchema = z.object({
  name: z.string().min(2, "Nom requis"),
  description: z.string().optional(),
  promotion_type: z.enum(["percentage", "fixed_amount", "bundle", "combo"]),
  discount_value: z.coerce.number().min(0).optional(),
  discount_percentage: z.coerce.number().min(0).max(100).optional(),
  items_config: z.object({
    services: z.array(z.string()).optional(),
    products: z.array(z.string()).optional(),
    beverages: z.array(z.string()).optional(),
  }).default({}),
  minimum_quantity: z.coerce.number().int().min(0).optional(),
  valid_from: z.string().optional(),
  valid_until: z.string().optional(),
  is_active: z.boolean().default(true),
});

export const customerSchema = z.object({
  first_name: z.string().min(2, "Prénom requis"),
  last_name: z.string().min(2, "Nom requis"),
  phone: z.string().min(8, "Téléphone requis"),
  email: z.string().email("Email invalide").optional().or(z.literal("")),
  birthday: z.string().optional(),
  gender: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
});

export const appointmentSchema = z.object({
  customer_id: z.string().min(1, "Client requis"),
  employee_id: z.string().optional(),
  service_id: z.string().min(1, "Service requis"),
  appointment_date: z.string().min(1, "Date requise"),
  appointment_time: z.string().min(1, "Heure requise"),
});

export type ServiceFormData = z.infer<typeof serviceSchema>;
export type ProductFormData = z.infer<typeof productSchema>;
export type BeverageFormData = z.infer<typeof beverageSchema>;
export type ExpenseFormData = z.infer<typeof expenseSchema>;
export type PromotionFormData = z.infer<typeof promotionSchema>;
export type CustomerFormData = z.infer<typeof customerSchema>;
export type AppointmentFormData = z.infer<typeof appointmentSchema>;
