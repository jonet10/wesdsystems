import React from 'react';
import { useSchoolSettings } from '@/hooks/useSchoolSettings';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface PalmaresPrintViewProps {
  palmaresData: any;
  academicYearName: string;
}

export const PalmaresPrintView: React.FC<PalmaresPrintViewProps> = ({ palmaresData, academicYearName }) => {
  const { settings } = useSchoolSettings();

  if (!palmaresData) return null;

  const { className, subjectName, teacherName, maxPoints, students, periodsFound } = palmaresData;

  // Define column headers based on periods found or default to 4 periods
  // The screenshot shows 1ère, 2ème, 3ème, 4ème Période.
  // Sort them if needed, but standard alphabetical for Etape 1, 2 works.
  const allPeriods = ["Etape 1", "Etape 2", "Etape 3", "Etape 4", "Trimestre 1", "Trimestre 2", "Trimestre 3"];
  const periodColumns = periodsFound && periodsFound.length > 0 
    ? allPeriods.filter(p => periodsFound.includes(p)) 
    : ["Etape 1", "Etape 2", "Etape 3", "Etape 4"];

  // If periodsFound doesn't match standard names, fallback to just sorting them
  const displayColumns = periodColumns.length > 0 ? periodColumns : periodsFound.sort();

  return (
    <div className="w-full bg-white text-black p-8 font-serif" id="palmares-print-area">
      <style type="text/css" media="print">
        {`
          @page { 
            size: ${students.length > 35 ? '8.5in 14in' : '8.5in 11in'}; 
            margin: 10mm; 
          }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          #palmares-print-area { width: 100%; }
        `}
      </style>
      
      {/* Header section */}
      <div className="text-center mb-6">
        <h1 className="text-xl font-bold uppercase tracking-wide">
          {settings?.name || "ÉCOLE DIOCÉSAINE SAINT VINCENT DE PAUL"}
        </h1>
        <p className="text-sm">
          {settings?.address || "Thomassin 25, Port-au-Prince, Haïti"}
        </p>
        <p className="text-sm">
          Tél: {settings?.phone || "(509) 4726-5777"}
        </p>
      </div>

      <div className="border-b-4 border-double border-blue-900 mb-6"></div>

      {/* Title section */}
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold mb-4">
          Palmarès ({academicYearName}) ({className})
        </h2>
        
        <div className="flex justify-between items-center px-8 text-sm font-semibold">
          <div>Enseignant : {teacherName}</div>
          <div>Matière : {subjectName}</div>
          <div>Sur : {maxPoints} Pts.</div>
        </div>
      </div>

      {/* Table section */}
      <table className="w-full border-collapse border border-black text-sm">
        <thead>
          <tr>
            <th className="border border-black p-1 w-12 text-center" rowSpan={2}>
              # d'ordre
            </th>
            <th className="border border-black p-1 w-1/4 text-center" rowSpan={2}>
              Noms
            </th>
            <th className="border border-black p-1 w-1/4 text-center" rowSpan={2}>
              Prénoms
            </th>
            <th className="border border-black p-1 text-center" colSpan={displayColumns.length}>
              Examens
            </th>
          </tr>
          <tr>
            {displayColumns.map((period: string, idx: number) => {
              const isFirst = period.includes("1");
              const suffix = isFirst ? "ère" : "ème";
              const cleanedName = period.replace("Etape", "").replace("Trimestre", "").trim();
              return (
                <th key={idx} className="border border-black p-1 text-center font-normal text-xs">
                  {cleanedName}{suffix}<br />
                  Période
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {students.map((student: any, idx: number) => (
            <tr key={student.student_id}>
              <td className="border border-black p-1 text-center font-medium">
                {String(idx + 1).padStart(2, '0')}-
              </td>
              <td className="border border-black p-1 px-2 font-medium uppercase">
                {student.last_name}
              </td>
              <td className="border border-black p-1 px-2">
                {student.first_name}
              </td>
              {displayColumns.map((period: string, pIdx: number) => (
                <td key={pIdx} className="border border-black p-1 text-center">
                  {student.period_scores[period] !== undefined && student.period_scores[period] !== "" 
                    ? student.period_scores[period] 
                    : ""}
                </td>
              ))}
            </tr>
          ))}
          {students.length === 0 && (
            <tr>
              <td colSpan={3 + displayColumns.length} className="border border-black p-4 text-center italic text-gray-500">
                Aucun élève trouvé pour cette classe.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      
      <div className="mt-8 text-xs text-right text-gray-500">
        Imprimé le {format(new Date(), "dd MMMM yyyy 'à' HH:mm", { locale: fr })}
      </div>
    </div>
  );
};
