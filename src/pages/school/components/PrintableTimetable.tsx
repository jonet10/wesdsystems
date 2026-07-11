import React from 'react';
import type { SchoolTimetableSlot } from "@/modules/school/services/timetableService";

interface Props {
  slots: SchoolTimetableSlot[];
  className?: string;
  showTeacher?: boolean;
}

const DAYS_OF_WEEK = [
  { value: 1, label: "LUNDI" },
  { value: 2, label: "MARDI" },
  { value: 3, label: "MERCREDI" },
  { value: 4, label: "JEUDI" },
  { value: 5, label: "VENDREDI" },
];

export function PrintableTimetable({ slots, className, showTeacher = false }: Props) {
  // Find unique timeslots
  const times = Array.from(new Set(slots.map(s => `${s.start_time.substring(0, 5)}-${s.end_time.substring(0, 5)}`))).sort();

  // Create a 2D grid
  const rows = times.map(timeStr => {
     const row: any = { time: timeStr };
     DAYS_OF_WEEK.forEach(d => {
        const slot = slots.find(s => s.day_of_week === d.value && `${s.start_time.substring(0, 5)}-${s.end_time.substring(0, 5)}` === timeStr);
        row[d.value] = slot ? (showTeacher && slot.teacher ? `${slot.subject?.name}\n${slot.teacher?.first_name} ${slot.teacher?.last_name}` : slot.subject?.name) : "";
     });
     return row;
  });

  const isCovered = Array(rows.length).fill(null).map(() => Array(5).fill(false));

  if (slots.length === 0) return null;

  return (
    <div className="w-full text-black printable-area">
      <style>{`
        @media print {
          @page { size: landscape; margin: 10mm; }
          body * { visibility: hidden; }
          .printable-area, .printable-area * { visibility: visible; }
          .printable-area { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>
      
      <h2 className="text-center font-bold uppercase mb-4 tracking-wider text-xl">
        CLASSE DE {className || "..."}
      </h2>

      <table className="w-full border-collapse border border-gray-800 text-sm">
        <thead>
          <tr>
            <th className="border border-gray-800 p-3 text-center uppercase font-bold bg-white w-32">HEURES</th>
            {DAYS_OF_WEEK.map(d => (
              <th key={d.value} className="border border-gray-800 p-3 text-center uppercase font-bold bg-white w-1/5">{d.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rIdx) => (
            <tr key={row.time}>
              <td className="border border-gray-800 p-2 text-center font-medium whitespace-nowrap">{row.time}</td>
              {DAYS_OF_WEEK.map((dayObj, cIdx) => {
                if (isCovered[rIdx][cIdx]) return null;
                
                const text = row[dayObj.value];
                if (!text || !text.trim()) {
                   return <td key={cIdx} className="border border-gray-800 p-2"></td>;
                }

                let colSpan = 1;
                let rowSpan = 1;

                // Horizontal Merge
                for (let c = cIdx + 1; c < 5; c++) {
                  if (rows[rIdx][DAYS_OF_WEEK[c].value]?.trim() === text.trim() && !isCovered[rIdx][c]) {
                    colSpan++;
                  } else {
                    break;
                  }
                }

                // Vertical Merge (only if no horizontal merge)
                if (colSpan === 1) {
                  for (let r = rIdx + 1; r < rows.length; r++) {
                    if (rows[r][dayObj.value]?.trim() === text.trim() && !isCovered[r][cIdx]) {
                      rowSpan++;
                    } else {
                      break;
                    }
                  }
                }

                // Mark covered
                for (let i = 0; i < rowSpan; i++) {
                  for (let j = 0; j < colSpan; j++) {
                    isCovered[rIdx + i][cIdx + j] = true;
                  }
                }

                const lines = text.split('\n');
                const isHeaderLike = colSpan > 2; // e.g. "Récréation"
                
                return (
                  <td 
                    key={cIdx} 
                    colSpan={colSpan} 
                    rowSpan={rowSpan} 
                    className={`border border-gray-800 p-2 text-center ${isHeaderLike ? 'font-black text-xl bg-gray-50' : 'font-medium'}`}
                  >
                    {lines.map((l: string, i: number) => (
                      <div key={i} className={i === 1 ? 'text-xs text-gray-600 mt-1 italic' : ''}>{l}</div>
                    ))}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
