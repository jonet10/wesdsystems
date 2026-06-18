import jsPDF from "jspdf";
import "jspdf-autotable";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import type { SchoolSetting } from "@/modules/school/types";

export interface ExportColumn {
  header: string;
  accessorKey: string;
  cell?: (item: any) => string;
}

export const getBase64ImageFromUrl = async (imageUrl: string): Promise<string> => {
  const res = await fetch(imageUrl);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

export const exportToPDF = async (
  title: string,
  data: any[],
  columns: ExportColumn[],
  settings: SchoolSetting | null,
  academicYearName: string | null,
  userName: string = "Système"
) => {
  const doc = new jsPDF("p", "pt", "a4");
  const pageWidth = doc.internal.pageSize.width;
  
  let currentY = 40;

  // Draw Header
  if (settings?.logo_url) {
    try {
      const base64 = await getBase64ImageFromUrl(settings.logo_url);
      doc.addImage(base64, 'PNG', 40, currentY, 50, 50);
      currentY += 60;
    } catch (e) {
      console.error("Failed to load logo", e);
    }
  }

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(settings?.name || "ÉTABLISSEMENT SCOLAIRE", pageWidth / 2, 50, { align: "center" });
  
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  let headerY = 65;
  if (settings?.address) { doc.text(`Adresse: ${settings.address}`, pageWidth / 2, headerY, { align: "center" }); headerY += 12; }
  if (settings?.phone) { doc.text(`Téléphone: ${settings.phone}`, pageWidth / 2, headerY, { align: "center" }); headerY += 12; }
  if (settings?.email) { doc.text(`Email: ${settings.email}`, pageWidth / 2, headerY, { align: "center" }); headerY += 12; }
  if (academicYearName) { doc.text(`Année Académique: ${academicYearName}`, pageWidth / 2, headerY, { align: "center" }); headerY += 12; }

  currentY = Math.max(currentY, headerY + 20);

  // Divider
  doc.setLineWidth(1);
  doc.line(40, currentY, pageWidth - 40, currentY);
  currentY += 20;

  // Title
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(title.toUpperCase(), pageWidth / 2, currentY, { align: "center" });
  currentY += 20;

  // Table
  const tableData = data.map(item => 
    columns.map(col => col.cell ? col.cell(item) : String(item[col.accessorKey] || "-"))
  );

  (doc as any).autoTable({
    startY: currentY,
    head: [columns.map(col => col.header)],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [41, 128, 185], textColor: 255 },
    styles: { fontSize: 9, cellPadding: 4 },
    margin: { top: 40, right: 40, bottom: 40, left: 40 },
    didDrawPage: (data: any) => {
      // Footer
      const str = "Page " + doc.internal.getNumberOfPages();
      const dateStr = `Imprimé le: ${format(new Date(), "dd/MM/yyyy à HH:mm", { locale: fr })}`;
      const userStr = `Par: ${userName}`;
      const footerY = doc.internal.pageSize.height - 20;
      
      doc.setFontSize(8);
      doc.setFont("helvetica", "italic");
      doc.text(dateStr, 40, footerY);
      doc.text(userStr, pageWidth / 2, footerY, { align: "center" });
      doc.text(str, pageWidth - 40, footerY, { align: "right" });
    }
  });

  doc.save(`${title.replace(/\s+/g, '_').toLowerCase()}.pdf`);
};

export const printDocument = (
  title: string,
  data: any[],
  columns: ExportColumn[],
  settings: SchoolSetting | null,
  academicYearName: string | null,
  userName: string = "Système"
) => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const tableHeaders = columns.map(c => `<th>${c.header}</th>`).join('');
  const tableRows = data.map(item => {
    return `<tr>${columns.map(col => `<td>${col.cell ? col.cell(item) : (item[col.accessorKey] || "-")}</td>`).join('')}</tr>`;
  }).join('');

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>${title}</title>
        <style>
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 20px; color: #333; }
          .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 20px; }
          .logo { max-width: 100px; max-height: 100px; margin-bottom: 10px; }
          .school-name { font-size: 24px; font-weight: bold; margin: 0 0 10px 0; }
          .school-info { font-size: 14px; margin: 5px 0; color: #555; }
          .title { text-align: center; font-size: 20px; font-weight: bold; margin: 20px 0; text-transform: uppercase; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
          th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; font-size: 12px; }
          th { background-color: #f4f4f4; font-weight: bold; }
          tr:nth-child(even) { background-color: #f9f9f9; }
          .footer { margin-top: 40px; border-top: 1px solid #ddd; padding-top: 10px; display: flex; justify-content: space-between; font-size: 10px; color: #777; font-style: italic; }
          @media print {
            body { padding: 0; }
            .footer { position: fixed; bottom: 0; width: 100%; background: white; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          ${settings?.logo_url ? `<img src="${settings.logo_url}" class="logo" />` : ''}
          <h1 class="school-name">${settings?.name || "ÉTABLISSEMENT SCOLAIRE"}</h1>
          ${settings?.address ? `<p class="school-info">Adresse: ${settings.address}</p>` : ''}
          ${settings?.phone ? `<p class="school-info">Téléphone: ${settings.phone}</p>` : ''}
          ${settings?.email ? `<p class="school-info">Email: ${settings.email}</p>` : ''}
          ${academicYearName ? `<p class="school-info">Année Académique: ${academicYearName}</p>` : ''}
        </div>
        
        <div class="title">${title}</div>
        
        <table>
          <thead><tr>${tableHeaders}</tr></thead>
          <tbody>${tableRows}</tbody>
        </table>
        
        <div class="footer">
          <div>Imprimé le: ${format(new Date(), "dd/MM/yyyy à HH:mm", { locale: fr })}</div>
          <div>Généré par: ${userName}</div>
        </div>
        
        <script>
          window.onload = () => {
            setTimeout(() => {
              window.print();
              setTimeout(() => window.close(), 500);
            }, 500);
          };
        </script>
      </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
};
