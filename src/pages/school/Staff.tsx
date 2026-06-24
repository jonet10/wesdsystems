import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Copy, RefreshCw, UserCheck } from "lucide-react";

const ROLE_LABELS: Record<string, string> = {
  school_admin: "Directeur / Admin",
  school_accountant: "Comptable",
  school_cashier: "Caissier(ère)",
  school_teacher: "Enseignant(e)",
};

const ROLE_COLORS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  school_admin: "destructive",
  school_accountant: "secondary",
  school_cashier: "outline",
  school_teacher: "default",
};

interface SchoolUser {
  id: string;
  full_name: string;
  username: string;
  role: string;
  email: string;
  is_active: boolean;
  created_at: string;
  permissions?: string[];
}

const SCHOOL_MODULES = [
  { id: "school:students", label: "Élèves (Lecture)" },
  { id: "school:enrollments", label: "Inscriptions & admissions" },
  { id: "school:classes", label: "Gestion des classes" },
  { id: "school:academic-years", label: "Années académiques" },
  { id: "school:parents", label: "Parents / Tuteurs" },
  { id: "school:teachers", label: "Professeurs" },
  { id: "school:fees", label: "Frais & Tarifs" },
  { id: "school:finance", label: "Fiche Financière" },
  { id: "school:invoices", label: "Factures" },
  { id: "school:payments", label: "Caisse" },
  { id: "school:expenses", label: "Dépenses" },
  { id: "school:inventory", label: "Fournitures (Stock)" },
  { id: "school:pos", label: "Caisse fournitures (POS)" },
  { id: "school:reports", label: "Rapports" },
  { id: "school:settings", label: "Paramètres" },
  { id: "school:staff", label: "Gestion du personnel" },
];

/** Normalize a name to a username: "Jean-Pierre Dupont" → "jean-pierre.dupont" */
function toUsername(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")   // strip accents
    .replace(/[^a-z0-9\s-]/g, "")      // remove special chars
    .trim()
    .split(/\s+/)
    .join(".");
}

/** Generate a secure random password */
function generatePassword(): string {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789!@#";
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export default function SchoolStaffPage() {
  const { user, profile } = useAuth();
  const businessId = profile?.business_id || user?.user_metadata?.business_id;

  const [data, setData] = useState<SchoolUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SchoolUser | null>(null);
  const [form, setForm] = useState({ name: "", role: "school_cashier" });
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [usernamePreview, setUsernamePreview] = useState("");
  const [tempPassword, setTempPassword] = useState("");
  const [createdResult, setCreatedResult] = useState<{ username: string; password: string; email: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<SchoolUser | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const load = async () => {
    if (!businessId) return;
    setLoading(true);
    try {
      const { data: users, error } = await supabase
        .from("profiles")
        .select("id, full_name, username, role, email, is_active, created_at, permissions")
        .eq("business_id", businessId)
        .in("role", ["school_cashier", "school_accountant", "school_teacher", "school_admin"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      setData((users || []) as SchoolUser[]);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [businessId]);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", role: "school_cashier" });
    setUsernamePreview("");
    setTempPassword(generatePassword());
    setCreatedResult(null);
    setSelectedPermissions(["school:payments", "school:invoices", "school:finance"]);
    setOpen(true);
  };

  const openEdit = (u: SchoolUser) => {
    setEditing(u);
    setForm({ name: u.full_name, role: u.role });
    setUsernamePreview(u.username || "");
    setTempPassword("");
    setCreatedResult(null);
    setSelectedPermissions(u.permissions || []);
    setOpen(true);
  };

  const handleNameChange = (name: string) => {
    setForm(f => ({ ...f, name }));
    setUsernamePreview(toUsername(name));
  };

  const handleRoleChange = (role: string) => {
    setForm(f => ({ ...f, role }));
    // Suggest default permissions based on role
    if (role === "school_cashier") {
      setSelectedPermissions(["school:payments", "school:invoices", "school:finance"]);
    } else if (role === "school_accountant") {
      setSelectedPermissions(["school:finance", "school:invoices", "school:expenses", "school:fees", "school:reports"]);
    } else if (role === "school_teacher") {
      setSelectedPermissions(["school:students", "school:parents", "school:classes"]);
    } else {
      setSelectedPermissions([]);
    }
  };

  const handlePermissionToggle = (modId: string) => {
    setSelectedPermissions(prev =>
      prev.includes(modId)
        ? prev.filter(x => x !== modId)
        : [...prev, modId]
    );
  };

  const handleSave = async () => {
    if (!businessId) return;
    if (!form.name.trim()) { toast.error("Le nom est requis"); return; }

    setIsSaving(true);
    try {
      if (editing) {
        // Update profile fields & permissions
        const { error } = await supabase
          .from("profiles")
          .update({ 
            full_name: form.name, 
            role: form.role,
            permissions: selectedPermissions
          })
          .eq("id", editing.id);
        if (error) throw error;

        // If a new temp password is typed, reset it using secure database RPC
        if (tempPassword.trim()) {
          const { error: pwErr } = await supabase.rpc("reset_user_password", {
            p_user_id: editing.id,
            p_password: tempPassword
          });
          if (pwErr) console.warn("Reset password RPC not available:", pwErr.message);
        }

        toast.success("Utilisateur modifié avec succès");
        setOpen(false);
        load();
      } else {
        // Create new staff account using secure database RPC (bypasses auth rate limits)
        const username = toUsername(form.name);
        const shortId = businessId.replace(/-/g, '').slice(0, 8);
        const email = `${username}.${shortId}@school.wesdsystems.app`;
        const password = tempPassword;

        const { data: rpcData, error: rpcErr } = await supabase.rpc("create_school_staff_member", {
          p_email: email,
          p_password: password,
          p_full_name: form.name,
          p_role: form.role,
          p_business_id: businessId,
          p_permissions: selectedPermissions,
        });

        if (rpcErr) throw rpcErr;
        
        const res = typeof rpcData === "string" ? JSON.parse(rpcData) : rpcData;
        if (!res?.success || !res?.user_id) {
          throw new Error(res?.error || "Impossible de créer l'utilisateur");
        }

        setCreatedResult({ username, password, email });
        toast.success("Compte créé avec succès !");
        load();
      }
    } catch (e: any) {
      toast.error(e.message || "Erreur lors de l'enregistrement");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ is_active: false })
        .eq("id", deleteConfirm.id);
      if (error) throw error;
      toast.success("Utilisateur désactivé");
      setDeleteConfirm(null);
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const toggleStatus = async (u: SchoolUser) => {
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ is_active: !u.is_active })
        .eq("id", u.id);
      if (error) throw error;
      toast.success(`Utilisateur ${!u.is_active ? "activé" : "désactivé"}`);
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copié dans le presse-papiers");
  };

  return (
    <DashboardLayout role="school_admin" title="Utilisateurs" subtitle="Comptes du personnel (Caissiers, Comptables, Enseignants)">
      <StaggerContainer className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6">
        <StaggerItem>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Comptes Utilisateurs</h1>
              <p className="text-muted-foreground">{data.length} compte(s) créé(s)</p>
            </div>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" /> Créer un compte
            </Button>
          </div>
        </StaggerItem>

        <StaggerItem>
          <div className="rounded-md border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom complet</TableHead>
                  <TableHead>Identifiant (username)</TableHead>
                  <TableHead>Rôle</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8">Chargement...</TableCell></TableRow>
                ) : data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                      <UserCheck className="h-10 w-10 mx-auto mb-3 opacity-30" />
                      <p>Aucun compte utilisateur créé</p>
                      <p className="text-xs mt-1">Créez des comptes pour vos caissiers, comptables et enseignants</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  data.map((u) => (
                    <TableRow key={u.id} className={!u.is_active ? "opacity-50" : ""}>
                      <TableCell className="font-medium">{u.full_name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <code className="bg-muted px-2 py-0.5 rounded text-sm font-mono">{u.username || "—"}</code>
                          {u.username && (
                            <button onClick={() => copyToClipboard(u.username)} className="text-muted-foreground hover:text-foreground">
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={ROLE_COLORS[u.role] || "default"}>
                          {ROLE_LABELS[u.role] || u.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant={u.is_active ? "outline" : "secondary"}
                          size="sm"
                          onClick={() => toggleStatus(u)}
                          className={u.is_active ? "text-green-600 border-green-200" : ""}
                        >
                          {u.is_active ? "Actif" : "Inactif"}
                        </Button>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(u)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost" size="icon"
                          className="text-destructive hover:bg-destructive/10"
                          onClick={() => setDeleteConfirm(u)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </StaggerItem>
      </StaggerContainer>

      {/* Create / Edit Dialog */}
      <Dialog open={open} onOpenChange={(o) => { if (!o) { setOpen(false); setCreatedResult(null); } }}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier" : "Créer"} un compte utilisateur</DialogTitle>
          </DialogHeader>

          {createdResult ? (
            /* ── Success screen ── */
            <div className="space-y-5 py-2">
              <div className="bg-green-50 dark:bg-green-950/40 p-4 rounded-xl border border-green-200 dark:border-green-800 space-y-4">
                <p className="text-sm font-semibold text-green-800 dark:text-green-300 text-center">
                  ✅ Compte créé — transmettez ces identifiants à l'utilisateur
                </p>

                <div className="space-y-3">
                  <div className="bg-white dark:bg-black/30 rounded-lg p-3 border flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Identifiant (username)</p>
                      <code className="font-mono font-bold text-base">{createdResult.username}</code>
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => copyToClipboard(createdResult.username)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="bg-white dark:bg-black/30 rounded-lg p-3 border flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Mot de passe temporaire</p>
                      <code className="font-mono font-bold text-base tracking-wider">{createdResult.password}</code>
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => copyToClipboard(createdResult.password)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground text-center">
                  ⚠️ Ce mot de passe n'est affiché qu'une seule fois. Notez-le bien.
                </p>
              </div>
              <Button className="w-full" onClick={() => { setOpen(false); setCreatedResult(null); }}>Fermer</Button>
            </div>
          ) : (
            /* ── Form ── */
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Nom complet *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Ex: Jean Dupont"
                  autoFocus
                />
                {usernamePreview && !editing && (
                  <p className="text-xs text-muted-foreground">
                    Identifiant généré : <code className="bg-muted px-1 rounded">{usernamePreview}</code>
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Rôle *</Label>
                <Select value={form.role} onValueChange={handleRoleChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="school_cashier">Caissier(ère)</SelectItem>
                    <SelectItem value="school_accountant">Comptable</SelectItem>
                    <SelectItem value="school_teacher">Enseignant(e)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 pt-1">
                <Label>Permissions / Modules autorisés</Label>
                <div className="border rounded-lg p-3 max-h-[160px] overflow-y-auto space-y-2 bg-muted/20">
                  {SCHOOL_MODULES.map((m) => (
                    <label key={m.id} className="flex items-center gap-2.5 text-sm cursor-pointer hover:text-foreground select-none">
                      <Checkbox
                        checked={selectedPermissions.includes(m.id)}
                        onCheckedChange={() => handlePermissionToggle(m.id)}
                      />
                      <span>{m.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {!editing && (
                <div className="space-y-2 pt-3 border-t">
                  <div className="flex items-center justify-between">
                    <Label>Mot de passe temporaire</Label>
                    <Button
                      type="button" variant="ghost" size="sm"
                      onClick={() => setTempPassword(generatePassword())}
                    >
                      <RefreshCw className="h-3.5 w-3.5 mr-1" /> Regénérer
                    </Button>
                  </div>
                  <div className="bg-muted rounded-lg p-3 flex items-center justify-between gap-3">
                    <code className="font-mono font-bold text-lg tracking-wider">{tempPassword}</code>
                    <Button size="icon" variant="ghost" onClick={() => copyToClipboard(tempPassword)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    L'utilisateur devra changer ce mot de passe à sa première connexion.
                  </p>
                </div>
              )}

              {editing && (
                <div className="space-y-2 pt-3 border-t">
                  <Label>Nouveau mot de passe (optionnel)</Label>
                  <Input
                    value={tempPassword}
                    onChange={(e) => setTempPassword(e.target.value)}
                    placeholder="Laisser vide pour conserver l'ancien"
                    type="text"
                    className="font-mono"
                  />
                </div>
              )}

              <DialogFooter className="pt-4">
                <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
                <Button onClick={handleSave} disabled={isSaving}>
                  {isSaving ? "Enregistrement..." : "Enregistrer"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteConfirm} onOpenChange={(o) => !o && setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Désactiver l'utilisateur</DialogTitle>
          </DialogHeader>
          <p className="py-4">
            Êtes-vous sûr de vouloir désactiver <strong>{deleteConfirm?.full_name}</strong> ?
            Le compte sera conservé mais l'accès sera bloqué.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Annuler</Button>
            <Button variant="destructive" onClick={handleDelete}>Désactiver</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
