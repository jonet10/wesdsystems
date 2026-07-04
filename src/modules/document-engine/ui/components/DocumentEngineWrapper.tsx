import React, { useEffect, useState } from 'react';
import { DocumentEngine } from '../../core/engine';
import { HTMLPrintPlugin } from '../../plugins/HTMLPrintPlugin';
import { TemplateRepository } from '../../storage/TemplateRepository';
import { useAuth } from '@/hooks/useAuth';
import { SchoolDocumentProvider } from '@/modules/school/adapters/SchoolDocumentProvider'; // Hardcoded for this POC
import { Loader2 } from 'lucide-react';

interface DocumentEngineWrapperProps {
  moduleName: string;
  contextId: string;
  fallback: React.ReactNode;
  templateId?: string;
}

// Instantiate engine once
const engine = new DocumentEngine();
engine.registerPlugin(new HTMLPrintPlugin());
engine.registerProvider(new SchoolDocumentProvider());

export function DocumentEngineWrapper({ moduleName, contextId, fallback, templateId }: DocumentEngineWrapperProps) {
  const { profile } = useAuth();
  const businessId = profile?.business_id;
  const [renderedContent, setRenderedContent] = useState<React.ReactNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function fetchAndRender() {
      if (!businessId) return;
      try {
        setLoading(true);
        let targetTemplateId = templateId;

        if (!targetTemplateId) {
          // 1. Fetch all templates for this module and find the active report_card
          const templates = await TemplateRepository.getTemplates(businessId, moduleName);
          const reportCardTemplate = templates.find(t => t.type === 'report_card' && t.status === 'PUBLISHED');

          if (!reportCardTemplate) {
            // No published template found, fallback to legacy
            setRenderedContent(fallback);
            setLoading(false);
            return;
          }
          targetTemplateId = reportCardTemplate.id;
        }

        // 2. Fetch the active AST
        const ast = await TemplateRepository.getActiveAST(targetTemplateId);
        if (!ast) {
          setRenderedContent(fallback);
          setLoading(false);
          return;
        }

        // 3. Generate document using the Engine
        const content = await engine.generateDocument(ast, contextId, moduleName, 'html');
        setRenderedContent(content);
      } catch (err) {
        console.error('[DocumentEngine] Failed to render document', err);
        setError(true);
      } finally {
        setLoading(false);
      }
    }

    fetchAndRender();
  }, [businessId, moduleName, contextId, templateId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-zinc-500">
        <Loader2 className="h-8 w-8 animate-spin mb-4" />
        <p>Génération du document par le moteur...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center text-red-500">
        <p>Une erreur est survenue lors de la génération du document.</p>
        <div className="mt-4 border-t border-dashed pt-4 opacity-50">
          <p className="text-sm">Fallback vers le système standard :</p>
          {fallback}
        </div>
      </div>
    );
  }

  return <>{renderedContent}</>;
}
