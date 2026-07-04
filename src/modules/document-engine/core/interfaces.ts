import { DocumentAST } from '../types/ast';
import { VariableDefinition, CollectionDefinition, DataPayload } from '../types/capabilities';

export interface DocumentPlugin {
  name: string;
  version: string;
  initialize(engine: DocumentEngine): void;
}

export interface DocumentRenderer {
  format: 'pdf' | 'html' | 'docx' | string;
  render(ast: DocumentAST, payload: DataPayload): Promise<any>;
}

export interface DocumentParser {
  sourceFormat: 'docx' | 'json' | string;
  parse(fileData: ArrayBuffer | Buffer | Blob): Promise<DocumentAST>;
}

export interface DataProvider {
  moduleName: string;
  getVariables(): VariableDefinition[];
  getCollections(): CollectionDefinition[];
  fetchData(contextId: string): Promise<DataPayload>;
}

export interface DocumentEngine {
  registerPlugin(plugin: DocumentPlugin): void;
  registerRenderer(renderer: DocumentRenderer): void;
  registerParser(parser: DocumentParser): void;
  registerProvider(provider: DataProvider): void;
  
  getRenderer(format: string): DocumentRenderer;
  getParser(format: string): DocumentParser;
  getProvider(moduleName: string): DataProvider;
  
  generateDocument(templateAst: DocumentAST, contextId: string, moduleName: string, format: string): Promise<any>;
}

export interface TemplateRepository {
  getTemplate(id: string): Promise<any>;
  saveTemplate(template: any): Promise<void>;
  getActiveVersion(templateId: string): Promise<DocumentAST>;
  saveVersion(templateId: string, ast: DocumentAST): Promise<void>;
}
