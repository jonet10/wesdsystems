export type BlockType = 'header' | 'studentInfo' | 'gradesTable' | 'text' | 'signatures' | 'spacer' | 'divider';

export interface BlockConfig {
  id: string;
  type: BlockType;
  settings: any;
}

export const AVAILABLE_BLOCKS: { type: BlockType; label: string; icon: string }[] = [
  { type: 'header', label: 'En-tête École', icon: 'Building2' },
  { type: 'studentInfo', label: 'Infos Élève', icon: 'User' },
  { type: 'gradesTable', label: 'Tableau des Notes', icon: 'Table' },
  { type: 'text', label: 'Texte Libre', icon: 'Type' },
  { type: 'signatures', label: 'Signatures', icon: 'PenTool' },
  { type: 'divider', label: 'Ligne Séparatrice', icon: 'Minus' },
  { type: 'spacer', label: 'Espace Vide', icon: 'Maximize2' },
];

// Default settings for each block type
export const getDefaultSettings = (type: BlockType) => {
  switch (type) {
    case 'header':
      return { 
        showLogo: true, 
        showRightLogo: false,
        showAddress: true, 
        showPhone: true, 
        alignment: 'center',
        name: '',
        address: '',
        phone: ''
      };
    case 'studentInfo':
      return { showPhoto: false, layout: 'row' }; // row or columns
    case 'gradesTable':
      return { 
        tableStyle: 'standard', // 'standard' | 'grouped' | 'haitian_full'
        tableBorderColor: '#000000',
        tableBorderSize: 1,
        showCoef: true, 
        showAppreciation: true, 
        showRank: false,
        showTotalRow: true,
        showAverageRow: true,
        showConductRow: false,
        showAbsenceRow: false,
        showTardinessRow: false,
        customRows: [] // { label: string, value: string }
      };
    case 'text':
      return { content: 'Double-cliquez pour éditer le texte...', alignment: 'left', fontSize: 12, bold: false };
    case 'signatures':
      return { leftLabel: 'Le Directeur', rightLabel: 'Les Parents' };
    case 'spacer':
      return { height: 20 }; // in pixels
    case 'divider':
      return { thickness: 1, style: 'solid', color: '#000000' };
    default:
      return {};
  }
};
