import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Printer, FileText } from "lucide-react";
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
    if (data.length === 0) {
      toast.error("Aucune donnée à exporter");
      return;
    }
    setIsExporting(true);
    try {
      await exportToPDF(title, data, columns, schoolSettings, academicYearName, userName);
      toast.success("PDF généré avec succès");
    } catch (e: any) {
      toast.error("Erreur lors de la génération du PDF", { description: e.message });
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrint = () => {
    if (data.length === 0) {
      toast.error("Aucune donnée à imprimer");
      return;
    }
    printDocument(title, data, columns, schoolSettings, academicYearName, userName);
  };

  return (
    <div className="flex items-center gap-2">
      <Button 
        variant="outline" 
        size="sm" 
        onClick={handlePrint}
        disabled={disabled || data.length === 0 || isExporting}
      >
        <Printer className="mr-2 h-4 w-4" />
        Imprimer
      </Button>
      <Button 
        variant="outline" 
        size="sm" 
        onClick={handlePDF}
        disabled={disabled || data.length === 0 || isExporting}
      >
        <FileText className="mr-2 h-4 w-4 text-red-500" />
        PDF
      </Button>
    </div>
  );
}
