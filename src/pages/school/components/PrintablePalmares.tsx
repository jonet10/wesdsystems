import React from 'react';

interface Domain {
  id: string;
  name: string;
  display_order: number;
}

interface Subject {
  id: string;
  name: string;
  domain_id: string | null;
  coefficient: number;
}

interface PrintablePalmaresProps {
  schoolName: string;
  className: string;
  periodName: string;
  students: any[];
  groupedExams: { domain: Domain | null, exams: any[] }[];
  subjects: Subject[];
  gradesMap: Record<string, Record<string, string>>;
}

export function PrintablePalmares({
  schoolName,
  className,
  periodName,
  students,
  groupedExams,
  subjects,
  gradesMap
}: PrintablePalmaresProps) {
  
  if (students.length === 0 || groupedExams.length === 0) return null;

  // Calculate Grand Max
  let grandMax = 0;
  groupedExams.forEach(g => {
    g.exams.forEach(e => {
      grandMax += Number(e.max_points) || 0;
    });
  });

  const getMention = (moyenne: number) => {
    if (moyenne >= 9) return "Excellent";
    if (moyenne >= 8) return "Très Bien";
    if (moyenne >= 7) return "Bien";
    if (moyenne >= 6) return "Assez Bien";
    if (moyenne >= 5) return "Passable";
    return "Échec";
  };

  return (
    <div className="hidden print:block w-full text-black printable-area">
      <style>{`
        @media print {
          @page { size: legal landscape; margin: 10mm; }
          
          /* 1. HIDE NON-PRINTABLE ELEMENTS (MAXIMUM SPECIFICITY) */
          #root aside, #root aside.h-screen, #root header, #root nav, #root .print\\:hidden, #root .subscription-reminder { 
            display: none !important; 
          }
          
          /* 2. KILL ALL LAYOUT CONSTRAINTS THAT BREAK PAGINATION */
          /* Absolute nuke for any height/margin on ancestors to prevent blank first page */
          html, body, #root, #root > div, #root > div > div, main, .flex-1, .h-screen {
            display: block !important;
            height: auto !important;
            min-height: 0 !important;
            max-height: none !important;
            overflow: visible !important;
            position: static !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          
          /* Force full width on standard layout containers */
          .max-w-6xl, .mx-auto {
            max-width: none !important;
            margin-left: 0 !important;
            margin-right: 0 !important;
          }
          
          /* Un-hide flex elements but keep aside/header hidden */
          .flex:not(aside):not(header):not(.print\\:hidden):not(.subscription-reminder) {
            display: block !important;
          }
          
          /* 3. KILL ALL SPACERS THAT PUSH CONTENT DOWN */
          .space-y-6 > * + *, .space-y-4 > * + *, .mt-6, .p-4, .md\\:p-6 { 
            margin-top: 0 !important; 
            padding-top: 0 !important;
          }
          
          .printable-area { 
            width: 100%; 
            display: block !important; 
            margin: 0 !important;
            padding: 0 !important;
          }
          .no-print { display: none !important; }
          
          /* Vertical text for headers */
          .vertical-text {
            writing-mode: vertical-rl;
            transform: rotate(180deg);
            white-space: nowrap;
            padding: 2px;
            max-height: 140px;
          }
          
          /* Pagination fixes */
          table { 
            page-break-inside: auto; break-inside: auto; 
            page-break-before: avoid !important; break-before: avoid !important; 
          }
          tr { 
            page-break-inside: avoid; break-inside: avoid;
            page-break-after: auto; break-after: auto; 
          }
          thead { 
            display: table-header-group; 
          }
          tfoot { 
            display: table-footer-group; 
          }
          .avoid-break-after {
            page-break-after: avoid !important;
            break-after: avoid !important;
          }
          
          /* Enforce borders */
          table, th, td { 
            border: 1px solid #000000 !important; 
            border-color: #000000 !important;
          }
        }
      `}</style>
      
      <table className="w-full border-collapse border border-black text-[18px] leading-tight mx-auto" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
        <caption className="caption-top mb-5">
          <div className="text-center" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
            <h1 className="text-4xl font-bold m-0 p-0 text-black">{schoolName}</h1>
            <h2 className="text-2xl font-normal m-0 p-0 text-black">12, Rue Laleau, Thomassin 25, Pétion-Ville</h2>
            <h2 className="text-2xl font-normal m-0 p-0 mb-5 text-black">Tel : (509) 3686-7381 / 3648-3764</h2>
            
            <h3 className="text-lg font-normal m-0 p-0 text-black">Année Scolaire 2024-2025</h3>
            <h3 className="text-lg font-normal m-0 p-0 uppercase text-black">CLASSE {className}</h3>
            <h3 className="text-lg font-normal m-0 p-0 text-black">{periodName}</h3>
          </div>
        </caption>
        <thead>
          {/* Domains Row */}
          <tr>
            <th className="border border-black p-2 text-left" rowSpan={2}></th>
            {groupedExams.map((group, i) => (
              <th key={i} className="border border-black p-2 text-center font-normal text-[15px]" colSpan={group.exams.length + 2}>
                {group.domain ? group.domain.name : "Autres"}
              </th>
            ))}
            <th className="border border-black p-2 text-center bg-transparent" colSpan={2}></th>
            <th className="border border-black p-2 text-center bg-transparent" rowSpan={2}></th>
          </tr>
          {/* Subjects Row */}
          <tr>
            {groupedExams.map((group, i) => (
              <React.Fragment key={i}>
                {group.exams.map(exam => {
                  const subj = subjects.find(s => s.id === exam.subject_id);
                  return (
                    <th key={exam.id} className="border border-black align-bottom h-[200px] w-10 p-0 bg-transparent">
                      <div className="vertical-text mx-auto font-bold text-[14px]">
                        {subj?.name || "Inconnu"}
                      </div>
                    </th>
                  );
                })}
                <th className="border border-black align-bottom h-[200px] w-10 p-0 bg-transparent">
                  <div className="vertical-text mx-auto font-bold text-[14px]">Total</div>
                </th>
                <th className="border border-black align-bottom h-[200px] w-10 p-0 bg-transparent">
                  <div className="vertical-text mx-auto font-bold text-[14px]">moyenne</div>
                </th>
              </React.Fragment>
            ))}
            <th className="border border-black align-bottom h-[200px] w-16 bg-[#A69B70] p-0">
              <div className="vertical-text mx-auto font-black text-[14px]">Total</div>
            </th>
            <th className="border border-black align-bottom h-[200px] w-16 bg-[#A69B70] p-0">
              <div className="vertical-text mx-auto font-black text-[14px]">Moyenne</div>
            </th>
            <th className="border border-black align-bottom h-[200px] w-16 p-0 bg-transparent">
              <div className="vertical-text mx-auto font-black text-[14px]">Mention</div>
            </th>
          </tr>
          {/* Max Points Row */}
          <tr>
            <th className="border border-black p-3 text-left text-[15px] whitespace-nowrap bg-transparent font-normal">Nom et Prénom</th>
            {groupedExams.map((group, i) => {
              let groupMax = 0;
              return (
                <React.Fragment key={i}>
                  {group.exams.map(exam => {
                    const max = Number(exam.max_points) || 10;
                    groupMax += max;
                    return (
                      <th key={exam.id} className="border border-black p-1 text-center font-normal">
                        {max}
                      </th>
                    );
                  })}
                  <th className="border border-black p-1 text-center font-normal bg-transparent">
                    {groupMax}
                  </th>
                  <th className="border border-black p-1 text-center font-normal bg-[#E8E4D9]">
                    10.00
                  </th>
                </React.Fragment>
              );
            })}
            <th className="border border-black p-1 text-center font-normal bg-[#A69B70]">
              {grandMax}
            </th>
            <th className="border border-black p-1 text-center font-normal bg-[#A69B70]">
              10.00
            </th>
            <th className="border border-black p-1 text-center bg-transparent"></th>
          </tr>
        </thead>
        <tbody>
          {students.map((student) => {
            let studentGrandTotal = 0;

            return (
              <tr key={student.id}>
                <td className="border border-black p-3 font-medium max-w-[260px] overflow-hidden text-ellipsis whitespace-nowrap">
                  {student.first_name} {student.last_name}
                </td>
                
                {groupedExams.map((group, i) => {
                  let groupTotal = 0;
                  let groupMax = 0;
                  
                  return (
                    <React.Fragment key={i}>
                      {group.exams.map(exam => {
                        const valStr = gradesMap[student.id]?.[exam.id];
                        const val = valStr ? Number(valStr) : 0;
                        groupTotal += val;
                        groupMax += Number(exam.max_points) || 0;
                        studentGrandTotal += val;
                        
                        return (
                          <td key={exam.id} className="border border-black p-1 text-center">
                            {valStr || ""}
                          </td>
                        );
                      })}
                      
                      {/* Domain Total & Average */}
                      <td className="border border-black p-1 text-center font-normal">
                        {groupTotal.toFixed(2).replace('.00', '')}
                      </td>
                      <td className="border border-black p-1 text-center font-normal bg-[#E8E4D9]">
                        {groupMax > 0 ? ((groupTotal / groupMax) * 10).toFixed(2) : ""}
                      </td>
                    </React.Fragment>
                  );
                })}

                {/* Grand Total & Average */}
                <td className="border border-black p-1 text-center font-normal bg-[#A69B70]">
                  {studentGrandTotal.toFixed(2).replace('.00', '')}
                </td>
                <td className="border border-black p-1 text-center font-normal bg-[#A69B70]">
                  {grandMax > 0 ? ((studentGrandTotal / grandMax) * 10).toFixed(2) : ""}
                </td>
                
                {/* Mention */}
                <td className="border border-black p-1 text-center font-normal text-xs bg-transparent">
                  {grandMax > 0 ? getMention((studentGrandTotal / grandMax) * 10) : ""}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
