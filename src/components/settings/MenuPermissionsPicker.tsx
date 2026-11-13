import React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckSquare, Square, RotateCcw, ShieldCheck } from "lucide-react";
import {
  getMenuPermissionsForModule,
  getDefaultPermissionsForRole,
  type MenuPermissionItem,
} from "@/config/module-menu-permissions";

interface MenuPermissionsPickerProps {
  module: "pharmacie" | "salon" | "auto_parts";
  selectedPermissions: string[];
  onChange: (permissions: string[]) => void;
  role?: string;
  className?: string;
}

export function MenuPermissionsPicker({
  module,
  selectedPermissions,
  onChange,
  role,
  className,
}: MenuPermissionsPickerProps) {
  const items = getMenuPermissionsForModule(module);

  const togglePermission = (id: string) => {
    if (selectedPermissions.includes(id)) {
      onChange(selectedPermissions.filter((p) => p !== id));
    } else {
      onChange([...selectedPermissions, id]);
    }
  };

  const selectAll = () => {
    onChange(items.map((i) => i.id));
  };

  const deselectAll = () => {
    onChange([]);
  };

  const resetToDefault = () => {
    if (role) {
      onChange(getDefaultPermissionsForRole(module, role));
    }
  };

  const activeCount = items.filter((i) => selectedPermissions.includes(i.id)).length;

  return (
    <div className={`space-y-3 rounded-lg border border-border p-3.5 bg-muted/20 ${className || ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2.5">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <span className="text-xs font-semibold uppercase tracking-wider text-foreground">
            Menus visibles pour cet employé
          </span>
          <Badge variant="secondary" className="text-[11px] font-mono">
            {activeCount} / {items.length} activé{activeCount > 1 ? "s" : ""}
          </Badge>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={selectAll}
            className="h-7 px-2 text-xs text-primary hover:text-primary-dark"
          >
            <CheckSquare className="h-3.5 w-3.5 mr-1" /> Tout cocher
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={deselectAll}
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            <Square className="h-3.5 w-3.5 mr-1" /> Tout décocher
          </Button>
          {role && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={resetToDefault}
              className="h-7 px-2 text-xs"
              title="Réinitialise selon les accès habituels de ce rôle"
            >
              <RotateCcw className="h-3 w-3 mr-1" /> Rôle par défaut
            </Button>
          )}
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Cochez ou décochez les menus que ce compte aura le droit de voir et d'utiliser dans la barre latérale.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 pt-1">
        {items.map((item: MenuPermissionItem) => {
          const isChecked = selectedPermissions.includes(item.id);
          return (
            <label
              key={item.id}
              className={`flex items-start gap-2.5 p-2 rounded-md border text-left cursor-pointer transition-colors ${
                isChecked
                  ? "border-primary/50 bg-primary/5 dark:bg-primary/10"
                  : "border-border/60 bg-background/50 hover:bg-muted/40 opacity-70"
              }`}
            >
              <Checkbox
                checked={isChecked}
                onCheckedChange={() => togglePermission(item.id)}
                className="mt-0.5"
              />
              <div className="flex-1 min-w-0">
                <span className={`text-xs font-medium block leading-tight ${isChecked ? "text-foreground font-semibold" : "text-muted-foreground"}`}>
                  {item.label}
                </span>
                <span className="text-[10px] text-muted-foreground/80 font-mono truncate block mt-0.5">
                  {item.path}
                </span>
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}
