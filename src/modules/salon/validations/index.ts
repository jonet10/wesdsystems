import { z } from "zod";

export const salonBusinessProfileSchema = z.object({
  businessName: z.string().min(1),
  slogan: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  taxNumber: z.string().optional(),
  currency: z.string().length(3),
});

export const commissionRuleSchema = z.object({
  employeeId: z.string().uuid(),
  serviceId: z.string().uuid().optional().nullable(),
  rateType: z.enum(["percentage", "fixed_amount"]),
  rateValue: z.number().min(0),
});

export const productPackagingSchema = z.object({
  unitsPerCase: z.number().int().positive(),
  stockCases: z.number().int().min(0),
  stockUnits: z.number().int().min(0),
});

export const stockMovementSchema = z.object({
  movementType: z.enum(["purchase", "sale", "adjustment", "loss", "audit"]),
  quantityDelta: z.number(),
  reason: z.string().optional(),
});
