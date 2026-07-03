import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { BlockConfig, BlockType, AVAILABLE_BLOCKS, getDefaultSettings } from './BlockTypes';
import { SortableBlock } from './components/SortableBlock';
import { BlockRenderer } from './components/BlockRenderer';
import { PropertiesPanel } from './components/PropertiesPanel';
import { Button } from '@/components/ui/button';
import { Save, FileText, ArrowLeft, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

export default function ReportBuilder() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [blocks, setBlocks] = useState<BlockConfig[]>([]);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [templateName, setTemplateName] = useState("Nouveau Modèle Personnalisé");
  const [templateId, setTemplateId] = useState<string | null>(null);

  // Configure DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    // If we wanted to load an existing template, we'd fetch it here.
    // For now, we start with an empty canvas or load the default "CUSTOM" template if it exists
    loadTemplate();
  }, []);

  const loadTemplate = async () => {
    try {
      const { data: profile } = await supabase.from('profiles').select('business_id').eq('id', user?.id).single();
      const bizId = profile?.business_id;
      if (!bizId) return;

      const { data, error } = await supabase
        .from('school_report_templates')
        .select('*')
        .eq('business_id', bizId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        setTemplateId(data.id);
        setTemplateName(data.name);
        setBlocks(data.layout_json || []);
      } else {
        // Initial dummy blocks just to show how it works
        setBlocks([
          { id: crypto.randomUUID(), type: 'header', settings: getDefaultSettings('header') },
          { id: crypto.randomUUID(), type: 'studentInfo', settings: getDefaultSettings('studentInfo') },
          { id: crypto.randomUUID(), type: 'gradesTable', settings: getDefaultSettings('gradesTable') },
          { id: crypto.randomUUID(), type: 'signatures', settings: getDefaultSettings('signatures') },
        ]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const addBlock = (type: BlockType) => {
    const newBlock: BlockConfig = {
      id: crypto.randomUUID(),
      type,
      settings: getDefaultSettings(type),
    };
    setBlocks([...blocks, newBlock]);
    setSelectedBlockId(newBlock.id);
    toast.success("Bloc ajouté");
  };

  const updateBlock = (updatedBlock: BlockConfig) => {
    setBlocks(blocks.map(b => b.id === updatedBlock.id ? updatedBlock : b));
  };

  const deleteBlock = (id: string) => {
    setBlocks(blocks.filter(b => b.id !== id));
    if (selectedBlockId === id) setSelectedBlockId(null);
  };

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (active.id !== over.id) {
      setBlocks((items) => {
        const oldIndex = items.findIndex(i => i.id === active.id);
        const newIndex = items.findIndex(i => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const saveTemplate = async () => {
    setIsSaving(true);
    try {
      const { data: profile } = await supabase.from('profiles').select('business_id').eq('id', user?.id).single();
      const bizId = profile?.business_id;
      if (!bizId) throw new Error("Business ID introuvable");

      const payload = {
        business_id: bizId,
        name: templateName,
        layout_json: blocks,
        is_default: true
      };

      if (templateId) {
        await supabase.from('school_report_templates').update(payload).eq('id', templateId);
      } else {
        const { data } = await supabase.from('school_report_templates').insert([payload]).select().single();
        if (data) setTemplateId(data.id);
      }

      // Automatically set the school_configurations to use CUSTOM
      await supabase.from('school_configurations').update({ bulletin_model: 'CUSTOM' }).eq('business_id', bizId);

      toast.success("Modèle enregistré avec succès !");
    } catch (err: any) {
      toast.error("Erreur lors de la sauvegarde", { description: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  const selectedBlock = blocks.find(b => b.id === selectedBlockId) || null;

  return (
    <DashboardLayout role="salon_admin" title="Constructeur de Bulletins">
      <div className="flex h-[calc(100vh-140px)] gap-4 overflow-hidden">
        
        {/* Left Sidebar - Available Blocks */}
        <div className="w-64 bg-card rounded-xl border shadow-sm flex flex-col h-full">
          <div className="p-4 border-b font-semibold flex items-center gap-2">
            <Plus size={18} /> Ajouter un bloc
          </div>
          <div className="p-2 overflow-y-auto flex-1 space-y-2">
            {AVAILABLE_BLOCKS.map(b => (
              <button
                key={b.type}
                onClick={() => addBlock(b.type)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-muted rounded flex items-center gap-3 transition-colors border border-transparent hover:border-border"
              >
                <div className="bg-primary/10 text-primary p-1.5 rounded">
                  <FileText size={16} />
                </div>
                {b.label}
              </button>
            ))}
          </div>
        </div>

        {/* Center Canvas - A4 Page */}
        <div className="flex-1 overflow-y-auto bg-gray-100/50 rounded-xl border flex flex-col items-center py-8 px-4" onClick={() => setSelectedBlockId(null)}>
          <div className="flex justify-between w-full max-w-[800px] mb-4">
            <Button variant="outline" onClick={() => navigate('/dashboard/school/settings')}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Retour aux paramètres
            </Button>
            <div className="flex items-center gap-4">
              <input 
                type="text" 
                value={templateName} 
                onChange={e => setTemplateName(e.target.value)}
                className="border-b bg-transparent font-semibold px-2 py-1 outline-none focus:border-primary w-64"
                placeholder="Nom du modèle..."
              />
              <Button onClick={saveTemplate} disabled={isSaving}>
                <Save className="mr-2 h-4 w-4" />
                {isSaving ? "Sauvegarde..." : "Enregistrer"}
              </Button>
            </div>
          </div>

          {/* The A4 Page Wrapper */}
          <div className="bg-white shadow-xl w-full max-w-[800px] min-h-[1131px] p-[10mm] relative" onClick={e => e.stopPropagation()}>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={blocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
                {blocks.map(block => (
                  <SortableBlock 
                    key={block.id} 
                    block={block} 
                    isSelected={selectedBlockId === block.id}
                    onSelect={() => setSelectedBlockId(block.id)}
                    onDelete={() => deleteBlock(block.id)}
                  >
                    <BlockRenderer block={block} />
                  </SortableBlock>
                ))}
                {blocks.length === 0 && (
                  <div className="h-full flex items-center justify-center text-muted-foreground border-2 border-dashed border-gray-300 rounded-xl p-12 text-center mt-20">
                    <p>Votre bulletin est vide.<br/>Cliquez sur les blocs à gauche pour commencer à construire votre modèle.</p>
                  </div>
                )}
              </SortableContext>
            </DndContext>
          </div>
        </div>

        {/* Right Sidebar - Properties */}
        <div className="w-80 bg-card rounded-xl border shadow-sm flex flex-col h-full overflow-y-auto">
          <PropertiesPanel block={selectedBlock} onUpdate={updateBlock} />
        </div>

      </div>
    </DashboardLayout>
  );
}
