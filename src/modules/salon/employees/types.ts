export interface SalonEmployeeCommissionConfig {
  employeeId: string;
  baseSalary: number;
  commissionType: "none" | "percentage" | "fixed_amount" | "hybrid" | "custom";
  commissionPercentage: number;
  fixedCommissionAmount: number;
}

