import { printReport } from "@/lib/print-utils";
import { Button } from "@/components/ui/button";
import { FileDown, Printer } from "lucide-react";
import { useRef } from "react";

export function exportCSV(headers: string[], rows: (string | number | null | undefined)[][], filename = "export") {
  const csv = [
    headers.join(","),
    ...rows.map((r) => r.map((c) => {
      const s = String(c ?? "");
      return s.includes(",") || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(",")),
  ].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

interface ExportBarProps {
  filename?: string;
  headers: string[];
  rows: (string | number | null | undefined)[][];
  printRef?: React.RefObject<HTMLDivElement | null>;
}

export function ExportBar({ filename = "rapport", headers, rows, printRef }: ExportBarProps) {
  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" onClick={() => exportCSV(headers, rows, filename)}>
        <FileDown className="h-4 w-4 mr-1" /> Excel
      </Button>
      <Button variant="outline" size="sm" onClick={async () => {
        if (printRef?.current) await printReport(printRef.current, filename);
        else window.print();
      }}>
        <Printer className="h-4 w-4 mr-1" /> Imprimer / PDF
      </Button>
    </div>
  );
}
