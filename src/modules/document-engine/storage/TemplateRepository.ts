import { supabase } from '@/lib/supabase';
import { DocumentAST } from '../types/ast';

export interface DocumentTemplate {
  id: string;
  business_id: string;
  module: string;
  name: string;
  type: string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  active_version_id: string | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface DocumentTemplateVersion {
  id: string;
  template_id: string;
  version_number: number;
  ast_payload: DocumentAST;
  storage_path: string | null;
  author_id: string | null;
  created_at: string;
}

export class TemplateRepository {
  /**
   * Fetches a template by ID
   */
  static async getTemplate(templateId: string): Promise<DocumentTemplate | null> {
    const { data, error } = await supabase
      .from('document_templates')
      .select('*')
      .eq('id', templateId)
      .single();

    if (error) {
      console.error('[DocumentEngine] Failed to fetch template', error);
      return null;
    }
    return data as DocumentTemplate;
  }

  /**
   * Fetches all templates for a business and module
   */
  static async getTemplates(businessId: string, moduleName: string): Promise<DocumentTemplate[]> {
    const { data, error } = await supabase
      .from('document_templates')
      .select('*')
      .eq('business_id', businessId)
      .eq('module', moduleName)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[DocumentEngine] Failed to fetch templates', error);
      return [];
    }
    return data as DocumentTemplate[];
  }

  /**
   * Fetches the active version's AST for a given template
   */
  static async getActiveAST(templateId: string): Promise<DocumentAST | null> {
    const template = await this.getTemplate(templateId);
    if (!template || !template.active_version_id) return null;

    const { data, error } = await supabase
      .from('document_template_versions')
      .select('ast_payload')
      .eq('id', template.active_version_id)
      .single();

    if (error) {
      console.error('[DocumentEngine] Failed to fetch active AST', error);
      return null;
    }

    return (data as any).ast_payload as DocumentAST;
  }

  /**
   * Creates a new template draft
   */
  static async createTemplate(templateData: Partial<DocumentTemplate>): Promise<DocumentTemplate | null> {
    const { data, error } = await supabase
      .from('document_templates')
      .insert(templateData)
      .select()
      .single();

    if (error) {
      console.error('[DocumentEngine] Failed to create template', error);
      return null;
    }

    // Audit log
    await this.logAuditAction(data.business_id, 'TEMPLATE_CREATED', 'document_templates', data.id);

    return data as DocumentTemplate;
  }

  /**
   * Saves a new version of the AST for a template
   */
  static async saveVersion(templateId: string, ast: DocumentAST, storagePath: string | null = null): Promise<DocumentTemplateVersion | null> {
    // 1. Get the current highest version number
    const { data: latestVersions } = await supabase
      .from('document_template_versions')
      .select('version_number')
      .eq('template_id', templateId)
      .order('version_number', { ascending: false })
      .limit(1);

    const nextVersion = latestVersions && latestVersions.length > 0 ? latestVersions[0].version_number + 1 : 1;

    // 2. Insert new version
    const { data: newVersion, error } = await supabase
      .from('document_template_versions')
      .insert({
        template_id: templateId,
        version_number: nextVersion,
        ast_payload: ast,
        storage_path: storagePath
      })
      .select()
      .single();

    if (error) {
      console.error('[DocumentEngine] Failed to save new version', error);
      return null;
    }

    return newVersion as DocumentTemplateVersion;
  }

  /**
   * Publishes a version (making it the active_version_id)
   */
  static async publishVersion(templateId: string, versionId: string, businessId: string): Promise<boolean> {
    const { error } = await supabase
      .from('document_templates')
      .update({ active_version_id: versionId, status: 'PUBLISHED' })
      .eq('id', templateId);

    if (error) {
      console.error('[DocumentEngine] Failed to publish version', error);
      return false;
    }

    // Audit log
    await this.logAuditAction(businessId, 'VERSION_PUBLISHED', 'document_template_versions', versionId);

    return true;
  }

  /**
   * Logs an action in the audit log
   */
  static async logAuditAction(businessId: string, action: string, entityType: string, entityId: string, metadata: Record<string, any> = {}): Promise<void> {
    await supabase.from('document_audit_logs').insert({
      business_id: businessId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      metadata
    });
  }
}
