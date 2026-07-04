import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PlusCircle, FileText, Settings, Upload, Edit } from 'lucide-react';
import { TemplateRepository, DocumentTemplate } from '../storage/TemplateRepository';
import { useAuth } from '@/hooks/useAuth';

interface DocumentEngineDashboardProps {
  moduleName: string;
}

export function DocumentEngineDashboard({ moduleName }: DocumentEngineDashboardProps) {
  const { profile } = useAuth();
  const businessId = profile?.business_id;
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (businessId) {
      loadTemplates();
    }
  }, [businessId, moduleName]);

  const loadTemplates = async () => {
    setIsLoading(true);
    const data = await TemplateRepository.getTemplates(businessId!, moduleName);
    setTemplates(data);
    setIsLoading(false);
  };

  const handleCreateTemplate = async () => {
    if (!businessId) return;
    // In a real app, open a modal to ask for name/type before creation
    const newTemplate = await TemplateRepository.createTemplate({
      business_id: businessId,
      module: moduleName,
      name: 'Nouveau Modèle',
      type: 'report_card'
    });
    if (newTemplate) {
      loadTemplates();
      // Redirect to editor: navigate(`/document-engine/editor/${newTemplate.id}`)
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in zoom-in duration-300">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Moteur Documentaire</h2>
          <p className="text-muted-foreground">
            Gérez vos modèles de documents dynamiques (Bulletins, Certificats, etc.)
          </p>
        </div>
        <Button onClick={handleCreateTemplate}>
          <PlusCircle className="mr-2 h-4 w-4" /> Nouveau Modèle
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Vos modèles ({moduleName})</CardTitle>
          <CardDescription>
            Liste de tous les modèles créés pour ce module.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center p-8">Chargement...</div>
          ) : templates.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed rounded-lg text-muted-foreground">
              <FileText className="mx-auto h-12 w-12 opacity-50 mb-4" />
              <p>Aucun modèle trouvé.</p>
              <p className="text-sm mt-2 mb-4">Créez votre premier modèle ou importez un fichier .docx</p>
              <Button onClick={handleCreateTemplate} variant="outline">
                <Upload className="mr-2 h-4 w-4" /> Créer / Importer
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Dernière modification</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((template) => (
                  <TableRow key={template.id}>
                    <TableCell className="font-medium">{template.name}</TableCell>
                    <TableCell>{template.type}</TableCell>
                    <TableCell>
                      <Badge variant={template.status === 'PUBLISHED' ? 'default' : 'secondary'}>
                        {template.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{new Date(template.updated_at).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm">
                        <Edit className="h-4 w-4 mr-2" /> Éditer
                      </Button>
                      <Button variant="ghost" size="sm">
                        <Settings className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
