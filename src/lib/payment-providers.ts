export interface PaymentProvider {
  id: string;
  label: string;
  description: string;
  icon?: string;
}

export interface PaymentProviderConfig {
  provider: PaymentProvider;
  accountNumber?: string;
  accountName?: string;
}

export const PAYMENT_PROVIDERS: PaymentProvider[] = [
  {
    id: "moncash",
    label: "MonCash",
    description: "Paiement par transfert MonCash",
    icon: "smartphone",
  },
  {
    id: "natcash",
    label: "NatCash",
    description: "Paiement par transfert NatCash",
    icon: "smartphone",
  },
];

export const PAYMENT_PROVIDER_CONFIGS: Record<string, PaymentProviderConfig> = {
  moncash: {
    provider: PAYMENT_PROVIDERS[0],
    accountNumber: "+50931966855",
    accountName: "WesdSystems",
  },
  natcash: {
    provider: PAYMENT_PROVIDERS[1],
    accountNumber: "+50931966855",
    accountName: "WesdSystems",
  },
};

export function getPaymentProvider(id: string): PaymentProvider | undefined {
  return PAYMENT_PROVIDERS.find((p) => p.id === id);
}

export function getProviderConfig(id: string): PaymentProviderConfig | undefined {
  return PAYMENT_PROVIDER_CONFIGS[id];
}

export type PaymentStatus = "pending" | "pending_verification" | "completed" | "approved" | "rejected" | "failed";

export interface SubscriptionPayment {
  id: string;
  business_id: string;
  plan_id: string;
  amount: number;
  currency_code: string;
  payment_method: string;
  transaction_reference: string;
  transaction_id?: string | null;
  moncash_payment_id?: string | null;
  phone_number: string | null;
  status: PaymentStatus;
  admin_id?: string | null;
  admin_notes?: string | null;
  approved_at?: string | null;
  completed_at?: string | null;
  created_at: string;
}

export function formatPaymentStatus(status: PaymentStatus): string {
  const labels: Record<PaymentStatus, string> = {
    pending: "En attente",
    pending_verification: "Vérification en cours",
    completed: "Complété",
    approved: "Approuvé",
    rejected: "Rejeté",
    failed: "Échoué",
  };
  return labels[status] || status;
}

export function isFinalPaymentStatus(status: PaymentStatus): boolean {
  return ["completed", "approved", "rejected", "failed"].includes(status);
}
