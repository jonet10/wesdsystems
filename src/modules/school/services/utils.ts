let _businessId: string | null = null;

export function setBusinessId(id: string | null) {
  _businessId = id;
}

export function getBusinessId(): string {
  if (!_businessId) throw new Error("Business ID not set. Call setBusinessId first.");
  return _businessId;
}
