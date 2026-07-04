import { DocumentEngine as IDocumentEngine, DocumentPlugin, DocumentRenderer, DocumentParser, DataProvider } from './interfaces';
import { DocumentAST } from '../types/ast';
import { VariableRegistry } from './Registry';

export class DocumentEngine implements IDocumentEngine {
  private plugins: Map<string, DocumentPlugin> = new Map();
  private renderers: Map<string, DocumentRenderer> = new Map();
  private parsers: Map<string, DocumentParser> = new Map();
  private providers: Map<string, DataProvider> = new Map();

  public registerPlugin(plugin: DocumentPlugin): void {
    this.plugins.set(plugin.name, plugin);
    plugin.initialize(this);
  }

  public registerRenderer(renderer: DocumentRenderer): void {
    this.renderers.set(renderer.format, renderer);
  }

  public registerParser(parser: DocumentParser): void {
    this.parsers.set(parser.sourceFormat, parser);
  }

  public registerProvider(provider: DataProvider): void {
    this.providers.set(provider.moduleName, provider);
    
    // Auto-register variables and collections to the global registry
    const registry = VariableRegistry.getInstance();
    provider.getVariables().forEach(v => registry.registerVariable(v));
    provider.getCollections().forEach(c => registry.registerCollection(c));
  }

  public getRenderer(format: string): DocumentRenderer {
    const renderer = this.renderers.get(format);
    if (!renderer) throw new Error(`[DocumentEngine] No renderer found for format: ${format}`);
    return renderer;
  }

  public getParser(format: string): DocumentParser {
    const parser = this.parsers.get(format);
    if (!parser) throw new Error(`[DocumentEngine] No parser found for format: ${format}`);
    return parser;
  }

  public getProvider(moduleName: string): DataProvider {
    const provider = this.providers.get(moduleName);
    if (!provider) throw new Error(`[DocumentEngine] No provider found for module: ${moduleName}`);
    return provider;
  }

  public async generateDocument(templateAst: DocumentAST, contextId: string, moduleName: string, format: string): Promise<any> {
    const provider = this.getProvider(moduleName);
    
    // 1. Fetch data payload for the specific context
    const dataPayload = await provider.fetchData(contextId);
    
    // 2. Resolve calculations and conditions here if needed (Data normalization)
    // (Omitted for brevity in POC)

    // 3. Render
    const renderer = this.getRenderer(format);
    return await renderer.render(templateAst, dataPayload);
  }
}
