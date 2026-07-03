import { useState } from 'react';
import { BlockConfig, BlockType, getDefaultSettings } from '../BlockTypes';

interface PropertiesPanelProps {
  block: BlockConfig | null;
  onUpdate: (updatedBlock: BlockConfig) => void;
}

export function PropertiesPanel({ block, onUpdate }: PropertiesPanelProps) {
  if (!block) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <p>Sélectionnez un bloc sur la page pour modifier ses propriétés.</p>
      </div>
    );
  }

  const handleSettingChange = (key: string, value: any) => {
    onUpdate({
      ...block,
      settings: { ...block.settings, [key]: value }
    });
  };

  return (
    <div className="p-4 space-y-6">
      <div>
        <h3 className="font-semibold text-lg border-b pb-2 mb-4">Propriétés du bloc</h3>
        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-4">Type : {block.type}</p>
      </div>

      {block.type === 'header' && (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold">Nom de l'établissement</label>
            <input 
              type="text" 
              value={block.settings.name || ''} 
              onChange={(e) => handleSettingChange('name', e.target.value)}
              placeholder="Ex: INSTITUTION SAINT-JEAN"
              className="w-full border rounded p-1.5 text-sm" 
            />
          </div>
          
          <div className="space-y-2 pt-2 border-t">
            <label className="flex items-center space-x-2 text-sm">
              <input type="checkbox" checked={block.settings.showAddress} onChange={(e) => handleSettingChange('showAddress', e.target.checked)} />
              <span className="font-semibold">Adresse</span>
            </label>
            {block.settings.showAddress && (
              <input 
                type="text" 
                value={block.settings.address || ''} 
                onChange={(e) => handleSettingChange('address', e.target.value)}
                placeholder="Ex: 12 Rue de la Paix, Port-au-Prince"
                className="w-full border rounded p-1.5 text-sm" 
              />
            )}
          </div>

          <div className="space-y-2 pt-2 border-t">
            <label className="flex items-center space-x-2 text-sm">
              <input type="checkbox" checked={block.settings.showPhone} onChange={(e) => handleSettingChange('showPhone', e.target.checked)} />
              <span className="font-semibold">Téléphones</span>
            </label>
            {block.settings.showPhone && (
              <input 
                type="text" 
                value={block.settings.phone || ''} 
                onChange={(e) => handleSettingChange('phone', e.target.value)}
                placeholder="Ex: +509 37 00 00 00"
                className="w-full border rounded p-1.5 text-sm" 
              />
            )}
          </div>

          <div className="space-y-2 pt-2 border-t">
            <label className="flex items-center space-x-2 text-sm">
              <input type="checkbox" checked={block.settings.showLogo} onChange={(e) => handleSettingChange('showLogo', e.target.checked)} />
              <span className="font-semibold">Afficher le logo (Gauche)</span>
            </label>
            <label className="flex items-center space-x-2 text-sm mt-1">
              <input type="checkbox" checked={block.settings.showRightLogo ?? false} onChange={(e) => handleSettingChange('showRightLogo', e.target.checked)} />
              <span className="font-semibold">Afficher un 2ème logo (Droite)</span>
            </label>
          </div>

          <div className="space-y-1.5 pt-2 border-t">
            <label className="text-sm font-semibold">Alignement</label>
            <select 
              value={block.settings.alignment} 
              onChange={(e) => handleSettingChange('alignment', e.target.value)}
              className="w-full border rounded p-1.5 text-sm"
            >
              <option value="left">Gauche</option>
              <option value="center">Centré</option>
              <option value="right">Droite</option>
            </select>
          </div>
        </div>
      )}

      {block.type === 'gradesTable' && (
        <div className="space-y-4">
          <div>
            <h4 className="text-xs font-bold uppercase mb-2">Style et Apparence</h4>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold">Format du Tableau</label>
                <select 
                  value={block.settings.tableStyle || 'standard'} 
                  onChange={(e) => handleSettingChange('tableStyle', e.target.value)}
                  className="w-full border rounded p-1.5 text-sm"
                >
                  <option value="standard">Simple (Toutes les matières à la suite)</option>
                  <option value="grouped">Groupé par Domaine (Ex: Français, Maths...)</option>
                  <option value="haitian_full">Format Complet (Tableau gauche + Barre de Signatures droite)</option>
                </select>
              </div>
              <div className="flex gap-2">
                <div className="space-y-1.5 flex-1">
                  <label className="text-xs font-semibold">Couleur des bordures</label>
                  <input 
                    type="color" 
                    value={block.settings.tableBorderColor || '#000000'} 
                    onChange={(e) => handleSettingChange('tableBorderColor', e.target.value)}
                    className="w-full h-8 cursor-pointer rounded" 
                  />
                </div>
                <div className="space-y-1.5 flex-1">
                  <label className="text-xs font-semibold">Épaisseur bordure</label>
                  <input 
                    type="number" 
                    min="1" max="5"
                    value={block.settings.tableBorderSize || 1} 
                    onChange={(e) => handleSettingChange('tableBorderSize', parseInt(e.target.value))}
                    className="w-full border rounded p-1 h-8 text-sm" 
                  />
                </div>
              </div>
            </div>
          </div>
          
          <div className="pt-2 border-t">
            <h4 className="text-xs font-bold uppercase mb-2">Colonnes à afficher</h4>
            <div className="space-y-2">
              <label className="flex items-center space-x-2 text-sm">
                <input type="checkbox" checked={block.settings.showCoef} onChange={(e) => handleSettingChange('showCoef', e.target.checked)} />
                <span>Colonne Coefficients</span>
              </label>
              <label className="flex items-center space-x-2 text-sm">
                <input type="checkbox" checked={block.settings.showAppreciation} onChange={(e) => handleSettingChange('showAppreciation', e.target.checked)} />
                <span>Colonne Appréciations</span>
              </label>
              <label className="flex items-center space-x-2 text-sm">
                <input type="checkbox" checked={block.settings.showRank} onChange={(e) => handleSettingChange('showRank', e.target.checked)} />
                <span>Colonne Rang</span>
              </label>
            </div>
          </div>
          
          <div className="pt-2 border-t">
            <h4 className="text-xs font-bold uppercase mb-2">Lignes à afficher en bas</h4>
            <div className="space-y-2">
              <label className="flex items-center space-x-2 text-sm">
                <input type="checkbox" checked={block.settings.showTotalRow ?? true} onChange={(e) => handleSettingChange('showTotalRow', e.target.checked)} />
                <span>Ligne TOTAL</span>
              </label>
              <label className="flex items-center space-x-2 text-sm">
                <input type="checkbox" checked={block.settings.showAverageRow ?? true} onChange={(e) => handleSettingChange('showAverageRow', e.target.checked)} />
                <span>Ligne MOYENNE</span>
              </label>
              <label className="flex items-center space-x-2 text-sm">
                <input type="checkbox" checked={block.settings.showConductRow ?? false} onChange={(e) => handleSettingChange('showConductRow', e.target.checked)} />
                <span>Ligne Conduite</span>
              </label>
              <label className="flex items-center space-x-2 text-sm">
                <input type="checkbox" checked={block.settings.showAbsenceRow ?? false} onChange={(e) => handleSettingChange('showAbsenceRow', e.target.checked)} />
                <span>Ligne Absences</span>
              </label>
              <label className="flex items-center space-x-2 text-sm">
                <input type="checkbox" checked={block.settings.showTardinessRow ?? false} onChange={(e) => handleSettingChange('showTardinessRow', e.target.checked)} />
                <span>Ligne Retards</span>
              </label>
            </div>
          </div>
          
          <div className="pt-2 border-t">
            <h4 className="text-xs font-bold uppercase mb-2">Lignes Libres (Texte Personnalisé)</h4>
            <div className="space-y-3">
              {(block.settings.customRows || []).map((row: any, index: number) => (
                <div key={index} className="flex gap-2 items-start bg-gray-50 p-2 rounded border">
                  <div className="flex-1 space-y-2">
                    <input 
                      type="text" 
                      placeholder="Titre (ex: Mention)" 
                      value={row.label}
                      onChange={(e) => {
                        const newRows = [...(block.settings.customRows || [])];
                        newRows[index].label = e.target.value;
                        handleSettingChange('customRows', newRows);
                      }}
                      className="w-full border rounded p-1 text-xs"
                    />
                    <input 
                      type="text" 
                      placeholder="Valeur (ex: Très bien)" 
                      value={row.value}
                      onChange={(e) => {
                        const newRows = [...(block.settings.customRows || [])];
                        newRows[index].value = e.target.value;
                        handleSettingChange('customRows', newRows);
                      }}
                      className="w-full border rounded p-1 text-xs"
                    />
                  </div>
                  <button 
                    onClick={() => {
                      const newRows = [...(block.settings.customRows || [])];
                      newRows.splice(index, 1);
                      handleSettingChange('customRows', newRows);
                    }}
                    className="text-red-500 hover:bg-red-50 p-1 rounded"
                    title="Supprimer la ligne"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => {
                  const newRows = [...(block.settings.customRows || []), { label: '', value: '' }];
                  handleSettingChange('customRows', newRows);
                }}
                className="w-full py-1.5 border border-dashed border-gray-300 rounded text-xs font-semibold text-gray-600 hover:bg-gray-50 flex items-center justify-center gap-1"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
                Ajouter une ligne libre
              </button>
            </div>
          </div>
        </div>
      )}

      {block.type === 'text' && (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm">Contenu</label>
            <textarea 
              value={block.settings.content} 
              onChange={(e) => handleSettingChange('content', e.target.value)}
              className="w-full border rounded p-2 text-sm min-h-[100px]"
            />
          </div>
          <div className="flex gap-2">
            <div className="space-y-1.5 flex-1">
              <label className="text-sm">Taille</label>
              <input type="number" value={block.settings.fontSize} onChange={(e) => handleSettingChange('fontSize', Number(e.target.value))} className="w-full border rounded p-1.5 text-sm" />
            </div>
            <div className="space-y-1.5 flex-1">
              <label className="text-sm">Gras</label>
              <input type="checkbox" checked={block.settings.bold} onChange={(e) => handleSettingChange('bold', e.target.checked)} className="block mt-2" />
            </div>
          </div>
        </div>
      )}

      {block.type === 'signatures' && (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm">Label Gauche</label>
            <input type="text" value={block.settings.leftLabel} onChange={(e) => handleSettingChange('leftLabel', e.target.value)} className="w-full border rounded p-1.5 text-sm" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm">Label Droite</label>
            <input type="text" value={block.settings.rightLabel} onChange={(e) => handleSettingChange('rightLabel', e.target.value)} className="w-full border rounded p-1.5 text-sm" />
          </div>
        </div>
      )}

      {block.type === 'spacer' && (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm">Hauteur (pixels)</label>
            <input type="number" value={block.settings.height} onChange={(e) => handleSettingChange('height', Number(e.target.value))} className="w-full border rounded p-1.5 text-sm" />
          </div>
        </div>
      )}

    </div>
  );
}
