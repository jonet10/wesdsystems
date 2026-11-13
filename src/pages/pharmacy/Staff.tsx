import { useTranslation } from "react-i18next";
import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePharmacyBusinessId } from "@/modules/pharmacy/hooks/usePharmacyBusinessId";
import {
  listPharmacyStaff,
  createPharmacyStaffMember,
  updatePharmacyStaffMember,
  deletePharmacyStaffMember,
  getStoredStaffPermissions,
  pharmacyRoleLabel,
  PHARMACY_STAFF_ROLES,
  type PharmacyStaffMember,
  type PharmacyStaffRole,
} from "@/modules/pharmacy/services/staffService";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, KeyRound, Copy, UserCheck, UserX, RefreshCw, Users } from "lucide-react";
import { MenuPermissionsPicker } from "@/components/settings/MenuPermissionsPicker";
import { getDefaultPermissionsForRole } from "@/config/module-menu-permissions";

const emptyForm = {
  fullName: "",
  username: "",
  gender: "F" as "M" | "F",
  role: "pharmacy_cashier" as PharmacyStaffRole,
  pin: "",
  isActive: true,
};

function generatePin(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function slugifyUsername(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/\.+/g, ".")
    .replace(/^\.|\.$/g, "");
}

export default function PharmacyStaff() {
  const { t } = useTranslation();
  const businessId = usePharmacyBusinessId();

  const [staff, setStaff] = useState<PharmacyStaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PharmacyStaffMember | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<PharmacyStaffMember | null>(null);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<{ username: string; pin: string } | null>(null);

  const load = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    try {
      const data = await listPharmacyStaff(businessId);
      setStaff(data);
    } catch (e: any) {
      toast.error(e.message || "Impossible de charger les employés");
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, pin: generatePin() });
    setSelectedPermissions(getDefaultPermissionsForRole("pharmacie", "pharmacy_cashier"));
    setOpen(true);
  };

  const openEdit = (member: PharmacyStaffMember) => {
    setEditing(member);
    setForm({
      fullName: member.full_name || "",
      username: member.username || "",
      gender: (member.gender as "M" | "F") || "F",
      role: member.role,
      pin: "",
      isActive: member.is_active,
    });
    setSelectedPermissions(
      member.permissions ||
      getStoredStaffPermissions(businessId || "", member.id) ||
      getDefaultPermissionsForRole("pharmacie", member.role)
    );
    setOpen(true);
  };

  const handleRoleChange = (role: PharmacyStaffRole) => {
    setForm((prev) => ({ ...prev, role }));
    setSelectedPermissions(getDefaultPermissionsForRole("pharmacie", role));
  };

  const handleNameChange = (value: string) => {
    setForm((prev) => {
      // Auto-suggest a username while creating, unless it was already customised
      const auto = !editing && (!prev.username || prev.username === slugifyUsername(prev.fullName));
      return { ...prev, fullName: value, username: auto ? slugifyUsername(value) : prev.username };
    });
  };

  const handleSave = async () => {
    if (!businessId) return;
    if (!form.fullName.trim()) {
      toast.error("Le nom est requis");
      return;
    }
    if (!form.username.trim()) {
      toast.error("Le nom d'utilisateur est requis");
      return;
    }
    if (!editing && form.pin.trim().length < 6) {
      toast.error("Le PIN doit contenir au moins 6 caractères");
      return;
    }
    if (editing && form.pin.trim() && form.pin.trim().length < 6) {
      toast.error("Le PIN doit contenir au moins 6 caractères");
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        const result = await updatePharmacyStaffMember({
          userId: editing.id,
          businessId,
          fullName: form.fullName.trim(),
          username: form.username.trim(),
          role: form.role,
          gender: form.gender,
          permissions: selectedPermissions,
          isActive: form.isActive,
          pin: form.pin.trim() || undefined,
        });
        if (!result.success) {
          toast.error(result.error || "Erreur lors de la modification");
          return;
        }
        toast.success("Employé mis à jour avec permissions");
        setOpen(false);
        load();
      } else {
        const result = await createPharmacyStaffMember({
          businessId,
          fullName: form.fullName.trim(),
          username: form.username.trim(),
          pin: form.pin.trim(),
          role: form.role,
          gender: form.gender,
          permissions: selectedPermissions,
        });
        if (!result.success) {
          toast.error(result.error || "Erreur lors de la création");
          return;
        }
        toast.success("Compte employé créé avec permissions");
        setOpen(false);
        setCreated({ username: result.username || form.username.trim(), pin: form.pin.trim() });
        load();
      }
    } catch (e: any) {
      toast.error(e.message || "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!businessId || !deleteConfirm) return;
    setSaving(true);
    try {
      const res = await deletePharmacyStaffMember({
        userId: deleteConfirm.id,
        businessId,
      });
      if (!res.success) {
        toast.error(res.error || "Erreur lors de la suppression");
        return;
      }
      toast.success(`Le compte de "${deleteConfirm.full_name || deleteConfirm.username}" a été supprimé`);
      setDeleteConfirm(null);
      load();
    } catch (err: any) {
      toast.error(err.message || "Erreur de suppression");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (member: PharmacyStaffMember) => {
    try {
      const result = await updatePharmacyStaffMember({
        userId: member.id,
        isActive: !member.is_active,
      });
      if (!result.success) {
        toast.error(result.error || "Erreur");
        return;
      }
      toast.success(member.is_active ? "Compte désactivé" : "Compte activé");
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copié`);
    } catch {
      toast.error("Copie impossible");
    }
  };

  const activeCount = staff.filter((s) => s.is_active).length;

  return (
    <DashboardLayout
      role="salon_admin"
      title="Employés & Caissières"
      subtitle="Créez les comptes (nom d'utilisateur + PIN) de votre équipe pharmacie"
    >
      <StaggerContainer className="p-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { label: "Employés", value: staff.length, icon: <Users className="h-5 w-5 text-primary" />, bg: "bg-primary/10" },
            { label: "Comptes actifs", value: activeCount, icon: <UserCheck className="h-5 w-5 text-success" />, bg: "bg-success/10" },
            { label: "Comptes désactivés", value: staff.length - activeCount, icon: <UserX className="h-5 w-5 text-destructive" />, bg: "bg-destructive/10" },
          ].map((kpi, i) => (
            <StaggerItem key={i}>
              <Card className="border-0 shadow-sm">
                <CardContent className="pt-5">
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${kpi.bg}`}>{kpi.icon}</div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">{kpi.label}</p>
                      <p className="text-2xl font-bold">{kpi.value}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </StaggerItem>
          ))}
        </div>

        {/* Staff table */}
        <StaggerItem>
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Comptes employés</CardTitle>
                <Button size="sm" onClick={openCreate}>
                  <Plus className="h-4 w-4 mr-1" /> Nouvel employé
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-center text-muted-foreground py-8">{t("common.loading")}</p>
              ) : staff.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="font-medium">Aucun compte employé</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    Créez un nom d'utilisateur et un PIN pour votre première caissière
                  </p>
                  <Button onClick={openCreate}>
                    <Plus className="h-4 w-4 mr-1" /> Créer un employé
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nom</TableHead>
                      <TableHead>Nom d'utilisateur</TableHead>
                      <TableHead>Sexe</TableHead>
                      <TableHead>Rôle</TableHead>
                      <TableHead>{t("common.status")}</TableHead>
                      <TableHead>Créé le</TableHead>
                      <TableHead>{t("common.actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {staff.map((member) => (
                      <TableRow key={member.id}>
                        <TableCell className="font-semibold">{member.full_name || "-"}</TableCell>
                        <TableCell className="font-mono text-sm">{member.username || "-"}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              member.gender === "F"
                                ? "border-pink-300 text-pink-700 bg-pink-50 dark:bg-pink-950/30 dark:text-pink-300"
                                : "border-blue-300 text-blue-700 bg-blue-50 dark:bg-blue-950/30 dark:text-blue-300"
                            }
                          >
                            {member.gender === "F" ? "Femme" : "Homme"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{pharmacyRoleLabel(member.role, member.gender)}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={member.is_active ? "default" : "secondary"}>
                            {member.is_active ? "Actif" : "Désactivé"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {member.created_at ? new Date(member.created_at).toLocaleDateString("fr-FR") : "-"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button size="sm" variant="ghost" onClick={() => openEdit(member)} title="Modifier">
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => toggleActive(member)}
                              title={member.is_active ? "Désactiver" : "Activer"}
                            >
                              {member.is_active ? (
                                <UserX className="h-4 w-4 text-destructive" />
                              ) : (
                                <UserCheck className="h-4 w-4 text-success" />
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setDeleteConfirm(member)}
                              title="Supprimer définitivement"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </StaggerItem>
      </StaggerContainer>

      {/* Create / Edit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier l'employé" : "Nouvel employé"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Nom complet *</Label>
              <Input
                value={form.fullName}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Ex: Marie Joseph"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Sexe / Genre *</Label>
              <Select
                value={form.gender}
                onValueChange={(value: "M" | "F") => setForm({ ...form, gender: value })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="F">Femme (Caissière, Gérante...)</SelectItem>
                  <SelectItem value="M">Homme (Caissier, Gérant...)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Nom d'utilisateur *</Label>
              <Input
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                placeholder="Ex: marie.joseph"
                className="mt-1 font-mono"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Utilisé pour se connecter depuis l'onglet « Personnel / Caisse ».
              </p>
            </div>
            <div>
              <Label>Rôle</Label>
              <Select
                value={form.role}
                onValueChange={(value) => handleRoleChange(value as PharmacyStaffRole)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PHARMACY_STAFF_ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Menu permissions picker */}
            <MenuPermissionsPicker
              module="pharmacie"
              role={form.role}
              selectedPermissions={selectedPermissions}
              onChange={setSelectedPermissions}
            />

            <div>
              <Label>{editing ? "Nouveau PIN (laisser vide pour conserver)" : "PIN (6 chiffres) *"}</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  value={form.pin}
                  onChange={(e) => setForm({ ...form, pin: e.target.value })}
                  placeholder="6 chiffres minimum"
                  className="font-mono"
                  inputMode="numeric"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setForm({ ...form, pin: generatePin() })}
                  title="Générer un PIN"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {editing && (
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">Compte actif</p>
                  <p className="text-xs text-muted-foreground">Un compte désactivé ne peut plus se connecter.</p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant={form.isActive ? "destructive" : "default"}
                  onClick={() => setForm({ ...form, isActive: !form.isActive })}
                >
                  {form.isActive ? "Désactiver" : "Activer"}
                </Button>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Enregistrement..." : editing ? "Enregistrer" : "Créer le compte"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Credentials dialog shown once after creation */}
      <Dialog open={!!created} onOpenChange={(value) => !value && setCreated(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" /> Identifiants créés
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Communiquez ces identifiants à l'employé. Le PIN n'est plus affiché après fermeture de cette fenêtre.
            </p>
            <div className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Nom d'utilisateur</p>
                  <p className="font-mono font-semibold">{created?.username}</p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => created && copy(created.username, "Nom d'utilisateur")}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">PIN</p>
                  <p className="font-mono font-semibold">{created?.pin}</p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => created && copy(created.pin, "PIN")}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setCreated(null)}>Terminé</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={(v) => !v && setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" /> Supprimer le compte employé
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Êtes-vous sûr de vouloir supprimer définitivement le compte de{" "}
            <strong className="text-foreground">{deleteConfirm?.full_name}</strong> ({deleteConfirm?.username}) ?
            Cette action est irréversible et révoquera tous ses accès.
          </p>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              {t("common.cancel")}
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={saving}>
              {saving ? "Suppression..." : "Supprimer définitivement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
