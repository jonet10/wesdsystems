export interface SchoolSetting {
  id: string;
  business_id: string;
  logo_url?: string | null;
  name?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  currency: string;
  invoice_prefix: string;
  receipt_prefix: string;
  terms?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SchoolAcademicYear {
  id: string;
  business_id: string;
  name: string;
  start_date?: string | null;
  end_date?: string | null;
  active: boolean;
  created_at: string;
}

export interface SchoolClass {
  id: string;
  business_id: string;
  code?: string | null;
  name: string;
  cycle?: string | null;
  level?: string | null;
  level_order?: number | null;
  section?: string | null;
  max_students?: number | null;
  active?: boolean;
  created_at: string;
}

export interface SchoolFeeCategory {
  id: string;
  business_id: string;
  name: string;
  description?: string | null;
  is_mandatory: boolean;
  created_at: string;
}

export interface SchoolFee {
  id: string;
  business_id: string;
  class_id: string;
  academic_year_id: string;
  category_id: string;
  amount: number;
  created_at: string;
  
  // Relations
  category?: SchoolFeeCategory;
}

export interface SchoolPaymentTemplate {
  id: string;
  business_id: string;
  class_id: string;
  academic_year_id: string;
  name: string;
  total_amount: number;
  created_at: string;
}

export interface SchoolPaymentTemplateInstallment {
  id: string;
  template_id: string;
  title: string;
  percentage_or_amount: number;
  is_percentage: boolean;
  due_date?: string | null;
  created_at: string;
}

export interface SchoolParent {
  id: string;
  business_id: string;
  user_id?: string | null;
  first_name: string;
  last_name: string;
  phone?: string | null;
  email?: string | null;
  profession?: string | null;
  address?: string | null;
  created_at: string;
}

export interface SchoolStudent {
  id: string;
  business_id: string;
  branch_id?: string | null;
  matricule?: string | null;
  first_name: string;
  last_name: string;
  gender?: string | null;
  dob?: string | null;
  birth_department?: string | null;
  birth_commune?: string | null;
  birth_place?: string | null;
  is_handicapped?: boolean;
  handicap_type?: string | null;
  shift?: string | null;
  education_level?: string | null;
  class_level?: string | null;
  address_department?: string | null;
  address_commune?: string | null;
  address_section?: string | null;
  address_neighborhood?: string | null;
  mother_info?: any;
  father_info?: any;
  responsible_person_info?: any;
  address?: string | null;
  phone?: string | null;
  photo_url?: string | null;
  status: 'active' | 'inactive' | 'graduated' | 'transferred';
  created_at: string;
}

export interface SchoolStudentParent {
  student_id: string;
  parent_id: string;
  relationship?: string | null;
  is_primary: boolean;
  
  // Relations
  parent?: SchoolParent;
}

export interface SchoolEnrollment {
  id: string;
  business_id: string;
  branch_id?: string | null;
  student_id: string;
  class_id: string;
  academic_year_id: string;
  enrollment_date?: string | null;
  status: 'registered' | 'active' | 'withdrawn';
  created_at: string;
  
  // Relations
  school_class?: SchoolClass;
  academic_year?: SchoolAcademicYear;
}

export interface SchoolTeacher {
  id: string;
  business_id: string;
  branch_id?: string | null;
  user_id?: string | null;
  first_name: string;
  last_name: string;
  phone?: string | null;
  email?: string | null;
  subjects?: string[] | null;
  salary: number;
  hire_date?: string | null;
  photo_url?: string | null;
  active: boolean;
  created_at: string;
}

export interface SchoolInvoice {
  id: string;
  business_id: string;
  branch_id?: string | null;
  student_id: string;
  academic_year_id: string;
  invoice_number: string;
  total_amount: number;
  paid_amount: number;
  balance: number;
  status: 'draft' | 'pending' | 'partial' | 'paid' | 'overdue';
  issue_date?: string | null;
  due_date?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  
  // Relations
  student?: SchoolStudent;
  academic_year?: SchoolAcademicYear;
}

export interface SchoolInvoiceItem {
  id: string;
  invoice_id: string;
  fee_id?: string | null;
  description: string;
  amount: number;
  business_id: string;
  
  // Relations
  fee?: SchoolFee;
}

export interface SchoolPaymentPlan {
  id: string;
  invoice_id: string;
  business_id: string;
  title: string;
  amount_due: number;
  amount_paid: number;
  balance: number;
  due_date?: string | null;
  status: 'pending' | 'partial' | 'paid' | 'overdue';
  created_at: string;
  updated_at: string;
}

export interface SchoolPayment {
  id: string;
  business_id: string;
  branch_id?: string | null;
  invoice_id: string;
  payment_plan_id?: string | null;
  receipt_number: string;
  amount: number;
  payment_method: 'Cash' | 'MonCash' | 'NatCash' | 'Virement' | 'Chèque' | 'Carte bancaire' | 'Autre';
  payment_date: string;
  motif?: string | null;
  reference?: string | null;
  created_by?: string | null;
  created_at: string;
  
  // Relations
  invoice?: SchoolInvoice;
  payment_plan?: SchoolPaymentPlan;
}

export interface SchoolExpense {
  id: string;
  business_id: string;
  branch_id?: string | null;
  category: string;
  amount: number;
  expense_date?: string | null;
  description?: string | null;
  proof_url?: string | null;
  created_by?: string | null;
  created_at: string;
}
