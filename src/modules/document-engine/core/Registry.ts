import { VariableDefinition, CollectionDefinition } from '../types/capabilities';

export class VariableRegistry {
  private static instance: VariableRegistry;
  
  private variables: Map<string, VariableDefinition> = new Map();
  private collections: Map<string, CollectionDefinition> = new Map();

  private constructor() {}

  public static getInstance(): VariableRegistry {
    if (!VariableRegistry.instance) {
      VariableRegistry.instance = new VariableRegistry();
    }
    return VariableRegistry.instance;
  }

  public registerVariable(variable: VariableDefinition): void {
    if (this.variables.has(variable.id)) {
      console.warn(`[DocumentEngine] Variable ${variable.id} is being overwritten.`);
    }
    this.variables.set(variable.id, variable);
  }

  public registerCollection(collection: CollectionDefinition): void {
    if (this.collections.has(collection.id)) {
      console.warn(`[DocumentEngine] Collection ${collection.id} is being overwritten.`);
    }
    this.collections.set(collection.id, collection);
  }

  public getVariable(id: string): VariableDefinition | undefined {
    return this.variables.get(id);
  }

  public getCollection(id: string): CollectionDefinition | undefined {
    return this.collections.get(id);
  }

  public getAllVariables(): VariableDefinition[] {
    return Array.from(this.variables.values());
  }

  public getAllCollections(): CollectionDefinition[] {
    return Array.from(this.collections.values());
  }

  public clear(): void {
    this.variables.clear();
    this.collections.clear();
  }
}
