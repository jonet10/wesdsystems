import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Printer, FileText, FileSpreadsheet, FileDown, Download } from "lucide-react";
import { exportToPDF, printDocument, type ExportColumn } from "@/lib/school-export";
import type { SchoolSetting } from "@/modules/school/types";
import { toast } from "sonner";

interface ExportButtonsProps {
  data: any[];
  columns: ExportColumn[];
  title: string;
  schoolSettings: SchoolSetting | null;
  academicYearName: string | null;
  userName?: string;
  disabled?: boolean;
}

export function ExportButtons({ 
  data, 
  columns, 
  title, 
  schoolSettings, 
  academicYearName, 
  userName = "Système",
  disabled = false
}: ExportButtonsProps) {
  const [isExporting, setIsExporting] = useState(false);

  const handlePDF = async () => {
    if (data.length === 0) { toast.error("Aucune donnée à exporter"); return; }
    setIsExporting(true);
    try {
      await exportToPDF(title, data, columns, schoolSettings, academicYearName, userName);
      toast.success("PDF généré avec succès");
    } catch (e: any) {
      toast.error("Erreur PDF", { description: e.message });
    } finally { setIsExporting(false); }
  };

  const handlePrint = () => {
    if (data.length === 0) { toast.error("Aucune donnée à imprimer"); return; }
    printDocument(title, data, columns, schoolSettings, academicYearName, userName);
  };

  const handleExcel = async () => {
    if (data.length === 0) { toast.error("Aucune donnée à exporter"); return; }
    setIsExporting(true);
    try {
      const XLSX = await import("xlsx");
      const rows = data.map(item => {
        const row: Record<string, any> = {};
        columns.forEach(col => {
          row[col.header] = col.cell ? col.cell(item) : String(item[col.accessorKey] ?? "-");
        });
        return row;
      });
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, title);
      XLSX.writeFile(wb, `${title.replace(/\s+/g, '_')}.xlsx`);
      toast.success("Fichier Excel généré");
    } catch (e: any) {
      toast.error("Erreur Excel", { description: e.message });
    } finally {
      setIsExporting(false);
    }
  };

  const handleDOCX = () => {
    if (data.length === 0) { toast.error("Aucune donnée à exporter"); return; }
    const tableHeaders = columns.map(c => `<th>${c.header}</th>`).join('');
    const tableRows = data.map(item => 
      `<tr>${columns.map(col => `<td>${col.cell ? col.cell(item) : String(item[col.accessorKey] ?? "-")}</td>`).join('')}</tr>`
    ).join('');

    const html = `
      <html>
        <head><meta charset="utf-8"><title>${title}</title></head>
        <body>
          <h1 style="text-align:center">${schoolSettings?.name || "ÉTABLISSEMENT"}</h1>
          <p style="text-align:center">${title}</p>
          <table border="1" cellpadding="5" cellspacing="0" style="width:100%;border-collapse:collapse">
            <thead><tr>${tableHeaders}</tr></thead>
            <tbody>${tableRows}</tbody>
          </table>
          <p><em>Généré le ${new Date().toLocaleDateString("fr-FR")} par ${userName}</em></p>
        </body>
      </html>
    `;

    const blob = new Blob([html], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/\s+/g, '_')}.doc`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Document Word généré");
  };

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={handlePrint} disabled={disabled || data.length === 0 || isExporting}>
        <Printer className="mr-2 h-4 w-4" />Imprimer
      </Button>
      <Button variant="outline" size="sm" onClick={handlePDF} disabled={disabled || data.length === 0 || isExporting}>
        <FileText className="mr-2 h-4 w-4 text-red-500" />PDF
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" disabled={disabled || data.length === 0 || isExporting}>
            <FileDown className="mr-2 h-4 w-4" />Exporter
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleExcel}>
            <FileSpreadsheet className="mr-2 h-4 w-4 text-green-600" />Excel (.xlsx)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleDOCX}>
            <FileText className="mr-2 h-4 w-4 text-blue-600" />Word (.doc)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
