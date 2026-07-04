export type NodeType = 
  | 'document' 
  | 'page' 
  | 'section'
  | 'paragraph' 
  | 'text' 
  | 'variable' 
  | 'image' 
  | 'table' 
  | 'table_row' 
  | 'table_cell' 
  | 'repeater' 
  | 'conditional' 
  | 'barcode' 
  | 'qrcode' 
  | 'shape' 
  | 'line'
  | 'list';

export interface StyleDefinition {
  fontFamily?: string;
  fontSize?: string | number;
  fontWeight?: string | number;
  fontStyle?: 'normal' | 'italic';
  textDecoration?: 'none' | 'underline' | 'line-through';
  color?: string;
  backgroundColor?: string;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  marginTop?: string | number;
  marginBottom?: string | number;
  marginLeft?: string | number;
  marginRight?: string | number;
  paddingTop?: string | number;
  paddingBottom?: string | number;
  paddingLeft?: string | number;
  paddingRight?: string | number;
  borderWidth?: string | number;
  borderColor?: string;
  borderStyle?: string;
  width?: string | number;
  height?: string | number;
}

export interface ASTNode {
  id: string;
  type: NodeType;
  style?: StyleDefinition;
  metadata?: Record<string, any>;
}

export interface BlockNode extends ASTNode {
  children: ASTNode[];
}

export interface InlineNode extends ASTNode {}

// --- Specific Nodes ---

export interface DocumentNode extends BlockNode {
  type: 'document';
  pageSetup?: {
    width: string | number;
    height: string | number;
    orientation: 'portrait' | 'landscape';
    marginTop: string | number;
    marginBottom: string | number;
    marginLeft: string | number;
    marginRight: string | number;
  };
}

export interface PageNode extends BlockNode {
  type: 'page';
}

export interface ParagraphNode extends BlockNode {
  type: 'paragraph';
}

export interface TextNode extends InlineNode {
  type: 'text';
  content: string;
}

export interface VariableNode extends InlineNode {
  type: 'variable';
  variableId: string;
  fallbackValue?: string;
}

export interface ImageNode extends InlineNode {
  type: 'image';
  src: string; // URL or Asset ID
  alt?: string;
  aspectRatio?: number;
}

export interface TableNode extends BlockNode {
  type: 'table';
  columnsCount: number;
}

export interface TableRowNode extends BlockNode {
  type: 'table_row';
}

export interface TableCellNode extends BlockNode {
  type: 'table_cell';
  colSpan?: number;
  rowSpan?: number;
}

export interface RepeaterNode extends BlockNode {
  type: 'repeater';
  collectionId: string;
  itemAlias: string;
}

export interface ConditionalNode extends BlockNode {
  type: 'conditional';
  conditionId: string;
}

export interface BarcodeNode extends InlineNode {
  type: 'barcode' | 'qrcode';
  value: string; // Static string or variable notation
  format?: string;
}

export type DocumentAST = DocumentNode;
