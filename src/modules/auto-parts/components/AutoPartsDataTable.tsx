import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export function AutoPartsDataTable<T extends Record<string, any>>({
  rows,
  columns,
  onRowClick,
}: {
  rows: T[];
  columns: { key: string; label: string; render?: (row: T) => React.ReactNode }[];
  onRowClick?: (row: T) => void;
}) {
  if (rows.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Aucune donnée trouvée
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            {columns.map((col) => (
              <TableHead key={col.key} className="text-xs uppercase tracking-wider font-semibold">
                {col.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, i) => (
            <TableRow
              key={row.id ?? i}
              className={onRowClick ? "cursor-pointer hover:bg-muted/50" : ""}
              onClick={() => onRowClick?.(row)}
            >
              {columns.map((col) => (
                <TableCell key={col.key} className="py-3">
                  {col.render ? col.render(row) : row[col.key] ?? "-"}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
