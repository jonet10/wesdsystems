export interface VariableDefinition {
  id: string; // e.g., "student.firstName"
  category: string; // e.g., "Élève"
  type: 'string' | 'number' | 'date' | 'boolean' | 'image' | 'richtext';
  label: string; // e.g., "Prénom de l'élève"
  description?: string;
  defaultValue?: any;
  permissions?: string[];
  metadata?: Record<string, any>;
}

export interface CollectionDefinition {
  id: string; // e.g., "student.grades"
  label: string; // e.g., "Notes par matière"
  type: 'list' | 'table' | 'tree' | 'group';
  schema: VariableDefinition[]; // Columns/fields available in each item
  groupBy?: string[];
  sortBy?: { field: string; order: 'asc' | 'desc' }[];
}

export type Operator = 
  | 'eq' 
  | 'neq' 
  | 'gt' 
  | 'lt' 
  | 'gte' 
  | 'lte' 
  | 'contains' 
  | 'exists' 
  | 'notExists';

export interface ConditionRule {
  id: string;
  field: string;
  operator: Operator;
  value?: any;
  logicalOperator?: 'AND' | 'OR';
  nextRule?: ConditionRule;
}

export interface CalculationRule {
  id: string;
  targetVariableId: string;
  type: 'sum' | 'avg' | 'count' | 'min' | 'max' | 'percentage' | 'custom';
  sourceCollection: string;
  sourceField: string;
  weightField?: string;
  customExpression?: string;
}

export interface DataPayload {
  variables: Record<string, any>;
  collections: Record<string, any[]>;
}
