import { BlockConfig } from '../BlockTypes';

interface BlockRendererProps {
  block: BlockConfig;
}

export function BlockRenderer({ block }: BlockRendererProps) {
  const { type, settings } = block;

  switch (type) {
    case 'header':
      return (
        <div className={`mb-4`}>
          <div className="flex items-center justify-between">
            {settings.showLogo ? (
              <div className="h-16 w-16 bg-gray-200 rounded-full flex items-center justify-center text-gray-400 text-xs shrink-0">
                LOGO 1
              </div>
            ) : <div className="w-16"></div>}
            
            <div className={`flex-1 text-${settings.alignment || 'center'} px-4`}>
              <div className="font-extrabold text-lg uppercase">{settings.name || "NOM DE L'ÉTABLISSEMENT"}</div>
              {settings.showAddress && <div className="text-sm text-gray-600">{settings.address || "Adresse de l'école, Ville, Pays"}</div>}
              {settings.showPhone && <div className="text-sm text-gray-600">{settings.phone ? `Tél : ${settings.phone}` : "Tél : +509 37 00 00 00"}</div>}
            </div>

            {settings.showRightLogo ? (
              <div className="h-16 w-16 bg-gray-200 rounded-full flex items-center justify-center text-gray-400 text-xs shrink-0">
                LOGO 2
              </div>
            ) : <div className="w-16"></div>}
          </div>
        </div>
      );

    case 'studentInfo':
      return (
        <div className={`flex ${settings.layout === 'row' ? 'flex-row items-center gap-4' : 'flex-col gap-2'} border p-3 border-gray-300`}>
          {settings.showPhoto && (
            <div className="h-20 w-20 bg-gray-200 border text-gray-400 flex items-center justify-center text-xs">
              PHOTO
            </div>
          )}
          <div className="flex-1 space-y-1 text-sm">
            <div><span className="font-semibold">Nom de l'élève :</span> JEAN DUPONT</div>
            <div><span className="font-semibold">Classe :</span> 9ème Année Fondamentale</div>
          </div>
        </div>
      );

    case 'gradesTable':
      const borderColor = settings.tableBorderColor || '#000000';
      const borderSize = `${settings.tableBorderSize || 1}px`;
      const borderStyle = { borderColor, borderWidth: borderSize };
      const cellStyle = { borderColor, borderWidth: borderSize, borderStyle: 'solid' };

      const renderTable = () => (
        <table className="w-full border-collapse text-sm" style={borderStyle}>
          <thead>
            <tr className="bg-gray-100">
              <th className="p-2 text-left" style={cellStyle}>Disciplines</th>
              {settings.showCoef && <th className="p-2 text-center w-24" style={cellStyle}>Coef.</th>}
              <th className="p-2 text-center w-24" style={cellStyle}>Notes</th>
              {settings.showAppreciation && <th className="p-2 text-left w-32" style={cellStyle}>Appréciations</th>}
              {settings.showRank && <th className="p-2 text-center w-20" style={cellStyle}>Rang</th>}
            </tr>
          </thead>
          <tbody>
            {settings.tableStyle === 'grouped' || settings.tableStyle === 'haitian_full' ? (
              <>
                <tr>
                  <td colSpan={5} className="bg-gray-100 font-bold p-1 text-center" style={cellStyle}>Français</td>
                </tr>
                <tr>
                  <td className="p-2" style={cellStyle}>Lecture Expliquée</td>
                  {settings.showCoef && <td className="p-2 text-center" style={cellStyle}>10</td>}
                  <td className="p-2 text-center font-bold" style={cellStyle}>7.0</td>
                  {settings.showAppreciation && <td className="p-2 text-sm italic" style={cellStyle}>Passable</td>}
                  {settings.showRank && <td className="p-2 text-center" style={cellStyle}></td>}
                </tr>
                <tr>
                  <td className="p-2" style={cellStyle}>Grammaire</td>
                  {settings.showCoef && <td className="p-2 text-center" style={cellStyle}>20</td>}
                  <td className="p-2 text-center font-bold" style={cellStyle}>13.0</td>
                  {settings.showAppreciation && <td className="p-2 text-sm italic" style={cellStyle}>Assez bien</td>}
                  {settings.showRank && <td className="p-2 text-center" style={cellStyle}></td>}
                </tr>
                <tr className="font-bold bg-gray-50">
                  <td className="p-2 text-right" style={cellStyle}>Total Français</td>
                  {settings.showCoef && <td className="p-2 text-center" style={cellStyle}>30</td>}
                  <td className="p-2 text-center" style={cellStyle}>20.0</td>
                  {settings.showAppreciation && <td className="p-2" style={cellStyle}></td>}
                  {settings.showRank && <td className="p-2" style={cellStyle}></td>}
                </tr>
              </>
            ) : (
              <>
                <tr>
                  <td className="p-2" style={cellStyle}>Mathématiques</td>
                  {settings.showCoef && <td className="p-2 text-center" style={cellStyle}>3</td>}
                  <td className="p-2 text-center font-bold" style={cellStyle}>8.5</td>
                  {settings.showAppreciation && <td className="p-2 text-sm italic" style={cellStyle}>Bon travail</td>}
                  {settings.showRank && <td className="p-2 text-center" style={cellStyle}>2e</td>}
                </tr>
                <tr>
                  <td className="p-2" style={cellStyle}>Français</td>
                  {settings.showCoef && <td className="p-2 text-center" style={cellStyle}>3</td>}
                  <td className="p-2 text-center font-bold" style={cellStyle}>7.0</td>
                  {settings.showAppreciation && <td className="p-2 text-sm italic" style={cellStyle}>Assez bien</td>}
                  {settings.showRank && <td className="p-2 text-center" style={cellStyle}>12e</td>}
                </tr>
              </>
            )}

            {(settings.showTotalRow ?? true) && (
              <tr className="font-bold bg-gray-50">
                <td className="p-2 text-right" style={cellStyle}>GRAND TOTAL</td>
                {settings.showCoef && <td className="p-2 text-center" style={cellStyle}>6</td>}
                <td className="p-2 text-center" style={cellStyle}>15.5</td>
                {settings.showAppreciation && <td className="p-2" style={cellStyle}></td>}
                {settings.showRank && <td className="p-2" style={cellStyle}></td>}
              </tr>
            )}
            {(settings.showAverageRow ?? true) && (
              <tr className="font-bold bg-gray-50">
                <td className="p-2 text-right" style={cellStyle}>MOYENNE</td>
                {settings.showCoef && <td className="p-2 text-center" style={cellStyle}></td>}
                <td className="p-2 text-center text-lg" style={cellStyle}>7.75</td>
                {settings.showAppreciation && <td className="p-2" style={cellStyle}></td>}
                {settings.showRank && <td className="p-2" style={cellStyle}></td>}
              </tr>
            )}
            {settings.showConductRow && (
              <tr>
                <td className="p-2 text-right font-medium" style={cellStyle}>CONDUITE</td>
                {settings.showCoef && <td className="p-2 text-center" style={cellStyle}></td>}
                <td className="p-2 text-center" style={cellStyle}>10/10</td>
                {settings.showAppreciation && <td className="p-2 text-sm italic" style={cellStyle}>Très bien</td>}
                {settings.showRank && <td className="p-2" style={cellStyle}></td>}
              </tr>
            )}
            {settings.showAbsenceRow && (
              <tr>
                <td className="p-2 text-right font-medium text-gray-600" style={cellStyle}>Jours d'absence</td>
                {settings.showCoef && <td className="p-2 text-center" style={cellStyle}></td>}
                <td className="p-2 text-center" style={cellStyle}>0</td>
                {settings.showAppreciation && <td className="p-2" style={cellStyle}></td>}
                {settings.showRank && <td className="p-2" style={cellStyle}></td>}
              </tr>
            )}
            {settings.showTardinessRow && (
              <tr>
                <td className="p-2 text-right font-medium text-gray-600" style={cellStyle}>Retards</td>
                {settings.showCoef && <td className="p-2 text-center" style={cellStyle}></td>}
                <td className="p-2 text-center" style={cellStyle}>2</td>
                {settings.showAppreciation && <td className="p-2" style={cellStyle}></td>}
                {settings.showRank && <td className="p-2" style={cellStyle}></td>}
              </tr>
            )}
            {(settings.customRows || []).map((row: any, index: number) => (
              <tr key={`custom-${index}`}>
                <td className="p-2 text-right font-medium" style={cellStyle}>{row.label}</td>
                {settings.showCoef && <td className="p-2 text-center" style={cellStyle}></td>}
                <td className="p-2 text-center font-bold" style={cellStyle}>{row.value}</td>
                {settings.showAppreciation && <td className="p-2" style={cellStyle}></td>}
                {settings.showRank && <td className="p-2" style={cellStyle}></td>}
              </tr>
            ))}
          </tbody>
        </table>
      );

      if (settings.tableStyle === 'haitian_full') {
        return (
          <div className="flex w-full mb-6" style={{ border: `${borderSize} solid ${borderColor}` }}>
            <div className="flex-1 border-r" style={{ borderColor }}>
              {renderTable()}
            </div>
            <div className="w-32 flex flex-col bg-white">
              <div className="flex-1 flex items-center justify-center border-b" style={{ borderColor }}>
                <div className="transform -rotate-90 whitespace-nowrap font-bold text-gray-600 uppercase tracking-widest text-sm">
                  Signatures
                </div>
              </div>
              <div className="h-32 flex items-center justify-center border-b" style={{ borderColor }}>
                <div className="transform -rotate-90 whitespace-nowrap text-sm">
                  Direction
                </div>
              </div>
              <div className="h-24 flex items-center justify-center border-b" style={{ borderColor }}>
                <div className="transform -rotate-90 whitespace-nowrap text-sm">
                  Absences : <span className="font-bold">0</span>
                </div>
              </div>
              <div className="h-24 flex items-center justify-center">
                <div className="transform -rotate-90 whitespace-nowrap text-sm">
                  Retards : <span className="font-bold">2</span>
                </div>
              </div>
            </div>
          </div>
        );
      }

      return <div className="mb-6">{renderTable()}</div>;

    case 'text':
      return (
        <div 
          style={{ 
            fontSize: `${settings.fontSize || 12}px`, 
            fontWeight: settings.bold ? 'bold' : 'normal',
            textAlign: settings.alignment || 'left'
          }}
          className="whitespace-pre-wrap"
        >
          {settings.content || 'Texte vide'}
        </div>
      );

    case 'signatures':
      return (
        <div className="flex justify-between items-end pt-8 px-4">
          <div className="text-center">
            <div className="font-semibold mb-8">{settings.leftLabel || 'Le Directeur'}</div>
            <div className="border-t border-black w-40"></div>
          </div>
          <div className="text-center">
            <div className="font-semibold mb-8">{settings.rightLabel || 'Les Parents'}</div>
            <div className="border-t border-black w-40"></div>
          </div>
        </div>
      );

    case 'divider':
      return (
        <hr 
          style={{ 
            borderTopWidth: `${settings.thickness || 1}px`, 
            borderTopStyle: settings.style || 'solid', 
            borderColor: settings.color || '#000' 
          }} 
          className="my-2"
        />
      );

    case 'spacer':
      return (
        <div style={{ height: `${settings.height || 20}px` }} className="w-full relative group">
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 text-xs text-gray-400 bg-blue-50/50">
            Espace : {settings.height}px
          </div>
        </div>
      );

    default:
      return <div>Bloc inconnu: {type}</div>;
  }
}
