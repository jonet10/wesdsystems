import { useTranslation } from "react-i18next";
import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Search, UserCheck, BookOpen, Phone, DollarSign, Clock, Trash, X, ChevronDown, AlertCircle, Briefcase } from "lucide-react";
import { toast } from "sonner";
import { useCurrency } from "@/contexts/CurrencyContext";
import { ExportButtons } from "@/components/school/ExportButtons";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { useSchoolSettings } from "@/hooks/useSchoolSettings";
import { 
  useTeachers, 
  useCreateTeacher, 
  useUpdateTeacher, 
  useDeleteTeacher,
  useClasses,
  useSubjects,
  useTeacherAssignments,
  useSaveTeacherAssignments,
  useFindOrCreateSubject
} from "@/hooks/useSchoolData";
import type { SchoolTeacher } from "@/modules/school/types";

interface UIAssignment {
  class_id: string;
  subject_id: string;
  subject_name: string;
  hours_per_week: string; // stored as string to allow clearing
  hourly_rate: string;    // stored as string to allow clearing
}

// ─── Subject Tag Picker ───────────────────────────────────────────────────────
interface SubjectPickerProps {
  selected: string[];
  onChange: (updated: string[]) => void;
  catalogSubjects: { id: string; name: string }[];
}
function SubjectPicker({ selected, onChange, catalogSubjects }: SubjectPickerProps) {
  const [inputValue, setInputValue] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);

  const filtered = catalogSubjects.filter(
    s => s.name.toLowerCase().includes(inputValue.toLowerCase()) && !selected.includes(s.name)
  );

  const addFromCatalog = (name: string) => {
    if (selected.includes(name)) return;
    onChange([...selected, name]);
    setInputValue("");
    setShowDropdown(false);
  };

  const remove = (name: string) => onChange(selected.filter(s => s !== name));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Matières enseignées</Label>
        <a
          href="/school/subjects"
          className="text-xs text-primary hover:underline flex items-center gap-1"
          target="_blank"
          rel="noreferrer"
        >
          <BookOpen className="h-3 w-3" /> Gérer le catalogue
        </a>
      </div>
      {/* Tags */}
      <div className="flex flex-wrap gap-1.5 min-h-[38px] p-2 border rounded-md bg-background">
        {selected.map(s => (
          <span key={s} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
            {s}
            <button type="button" onClick={() => remove(s)} className="hover:text-destructive transition-colors">
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <div className="relative flex-1 min-w-[140px]">
          <input
            type="text"
            value={inputValue}
            onChange={e => { setInputValue(e.target.value); setShowDropdown(true); }}
            onFocus={() => setShowDropdown(true)}
            onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
            onKeyDown={e => { if (e.key === "Escape") setShowDropdown(false); }}
            placeholder={selected.length === 0 ? "Rechercher une matière du catalogue..." : "Ajouter..."}
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {showDropdown && (
            <div className="absolute left-0 top-full mt-1 z-50 w-64 rounded-md border bg-popover shadow-md max-h-52 overflow-y-auto">
              {filtered.length > 0 ? (
                filtered.map(s => (
                  <button
                    key={s.id}
                    type="button"
                    onMouseDown={() => addFromCatalog(s.name)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent text-left"
                  >
                    <BookOpen className="h-3 w-3 text-muted-foreground shrink-0" />
                    {s.name}
                  </button>
                ))
              ) : (
                <div className="px-3 py-4 text-center">
                  <p className="text-xs text-muted-foreground mb-1">
                    {inputValue ? `Aucune matière "${inputValue}" dans le catalogue.` : "Toutes les matières sont déjà sélectionnées."}
                  </p>
                  <a
                    href="/school/subjects"
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-primary hover:underline"
                  >
                    → Ajouter dans le catalogue Matières
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Les matières disponibles proviennent du <a href="/school/subjects" target="_blank" className="text-primary hover:underline">catalogue des matières</a>. Ajoutez-y de nouvelles matières si nécessaire.
      </p>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function SchoolTeachers() {
  const { t } = useTranslation();
  const { settings, activeAcademicYear } = useSchoolSettings();
  const { format: formatAmount } = useCurrency();
  const { user, profile } = useAuth();
  const businessId = profile?.business_id || user?.user_metadata?.business_id;

  // ── Connection Account state
  const [createAccount, setCreateAccount] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [hasLinkedAccount, setHasLinkedAccount] = useState(false);

  const { data: teachers = [], isLoading } = useTeachers();
  const { data: classes = [] } = useClasses();
  const { data: catalogSubjects = [] } = useSubjects();

  const createTeacher = useCreateTeacher();
  const updateTeacher = useUpdateTeacher();
  const deleteTeacher = useDeleteTeacher();
  const saveAssignmentsMutation = useSaveTeacherAssignments();
  const findOrCreateSubjectMutation = useFindOrCreateSubject();

  // ── Filters
  const [search, setSearch] = useState("");
  const [filterSubject, setFilterSubject] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  // ── Teacher Info Form
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<SchoolTeacher | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [dialogAssignments, setDialogAssignments] = useState<UIAssignment[]>([]);
  const { data: editingTeacherAssignments = [] } = useTeacherAssignments(editingTeacher?.id);

  useEffect(() => {
    if (editingTeacher) {
      if (editingTeacherAssignments && editingTeacherAssignments.length > 0) {
        setDialogAssignments(editingTeacherAssignments.map(a => ({
          class_id: a.class_id,
          subject_id: a.subject_id,
          subject_name: a.subject?.name || '',
          hours_per_week: String(Number(a.hours_per_week) || 4),
          hourly_rate: String(Number(a.hourly_rate) || 500),
        })));
      } else {
        setDialogAssignments([]);
      }
    } else {
      setDialogAssignments([]);
    }
  }, [editingTeacher, editingTeacherAssignments]);

  const handleAddDialogAssignment = () => {
    setDialogAssignments([
      ...dialogAssignments,
      {
        class_id: classes[0]?.id || "",
        subject_id: catalogSubjects[0]?.id || "",
        subject_name: catalogSubjects[0]?.name || "",
        hours_per_week: "4",
        hourly_rate: "500",
      }
    ]);
  };

  const handleRemoveDialogAssignment = (index: number) => {
    const next = [...dialogAssignments];
    next.splice(index, 1);
    setDialogAssignments(next);
  };

  const handleUpdateDialogAssignment = (index: number, key: keyof UIAssignment, value: string) => {
    const next = [...dialogAssignments];
    next[index] = { ...next[index], [key]: value };
    setDialogAssignments(next);
  };
  const [jobTitle, setJobTitle] = useState("Professeur");
  const [salary, setSalary] = useState("");
  const [hireDate, setHireDate] = useState("");
  const [active, setActive] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Auto-generate username when first or last name changes and no account exists yet
  useEffect(() => {
    if (!hasLinkedAccount && createAccount && (firstName || lastName)) {
      const generated = `${firstName.trim().toLowerCase()}.${lastName.trim().toLowerCase()}`
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s.-]/g, "")
        .replace(/\s+/g, ".");
      setUsername(generated);
    }
  }, [firstName, lastName, createAccount, hasLinkedAccount]);

  // ── Salary & Assignments Modal
  const [isSalaryModalOpen, setIsSalaryModalOpen] = useState(false);
  const [selectedTeacherForSalary, setSelectedTeacherForSalary] = useState<SchoolTeacher | null>(null);
  const [salaryType, setSalaryType] = useState<'fixed' | 'hourly'>('fixed');
  const [fixedSalaryAmount, setFixedSalaryAmount] = useState('');
  const [defaultHourlyRate, setDefaultHourlyRate] = useState('500');
  const [assignments, setAssignments] = useState<UIAssignment[]>([]);
  const [isSavingSalary, setIsSavingSalary] = useState(false);

  const { data: dbAssignments = [], isLoading: isLoadingAssignments } = useTeacherAssignments(selectedTeacherForSalary?.id);

  // Load existing assignments when modal opens
  useEffect(() => {
    if (!selectedTeacherForSalary) return;
    if (dbAssignments && dbAssignments.length > 0) {
      setSalaryType('hourly');
      setAssignments(dbAssignments.map(a => ({
        class_id: a.class_id,
        subject_id: a.subject_id,
        subject_name: a.subject?.name || '',
        hours_per_week: String(Number(a.hours_per_week) || 0),
        hourly_rate: String(Number(a.hourly_rate) || 0),
      })));
      setDefaultHourlyRate(dbAssignments[0]?.hourly_rate?.toString() || '500');
    } else {
      setSalaryType('fixed');
      setFixedSalaryAmount(selectedTeacherForSalary.salary ? selectedTeacherForSalary.salary.toString() : '');
      setAssignments([]);
    }
  }, [selectedTeacherForSalary, dbAssignments]);

  // ── Validation: detect duplicate class+subject combos
  const duplicates = assignments.reduce<Set<number>>((acc, a, i) => {
    assignments.forEach((b, j) => {
      if (i !== j && a.class_id === b.class_id && a.subject_id === b.subject_id && a.subject_id) {
        acc.add(i);
        acc.add(j);
      }
    });
    return acc;
  }, new Set());

  const hasDuplicates = duplicates.size > 0;

  // ── Form reset
  const resetForm = () => {
    setEditingTeacher(null);
    setFirstName(""); setLastName(""); setPhone(""); setEmail("");
    setJobTitle("Professeur"); setSalary(""); setHireDate(""); setActive(true);
    setCreateAccount(false);
    setUsername("");
    setPassword("");
    setHasLinkedAccount(false);
    setDialogAssignments([]);
  };

  const handleEdit = (teacher: SchoolTeacher) => {
    setEditingTeacher(teacher);
    setFirstName(teacher.first_name);
    setLastName(teacher.last_name);
    setPhone(teacher.phone || "");
    setEmail(teacher.email || "");
    setJobTitle(teacher.job_title || "Professeur");
    setSalary(teacher.salary ? teacher.salary.toString() : "");
    setHireDate(teacher.hire_date ? teacher.hire_date.split("T")[0] : "");
    setActive(teacher.active);
    setCreateAccount(false);
    setPassword("");
    if (teacher.user_id) {
      setHasLinkedAccount(true);
      supabase
        .from("profiles")
        .select("username")
        .eq("id", teacher.user_id)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.username) setUsername(data.username);
        });
    } else {
      setHasLinkedAccount(false);
      setUsername("");
    }
    setIsDialogOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) { toast.error("Veuillez saisir le prénom et le nom"); return; }
    setIsSaving(true);
    try {
      let linkedUserId = editingTeacher?.user_id || null;

      // 1. If we are editing and they typed a new password, reset it
      if (editingTeacher && editingTeacher.user_id && password.trim()) {
        const { error: pwErr } = await supabase.rpc("reset_user_password", {
          p_user_id: editingTeacher.user_id,
          p_password: password
        });
        if (pwErr) console.warn("Reset password error:", pwErr.message);
      }

      // 2. If createAccount is active and they don't have a linked account yet:
      if (!linkedUserId && createAccount && username.trim() && password.trim()) {
        if (!businessId) {
          throw new Error("Impossible d'associer un compte de connexion sans ID d'établissement.");
        }
        const shortId = businessId.replace(/-/g, '').slice(0, 8);
        const generatedEmail = `${username.trim().toLowerCase()}.${shortId}@school.wesdsystems.app`;
        
        // Define default permissions for teacher
        const defaultPermissions = ["school:students", "school:parents", "school:classes"];

        const { data: rpcData, error: rpcErr } = await supabase.rpc("create_school_staff_member", {
          p_email: generatedEmail,
          p_password: password,
          p_full_name: `${firstName} ${lastName}`,
          p_role: "school_teacher",
          p_business_id: businessId,
          p_permissions: defaultPermissions,
        });

        if (rpcErr) throw rpcErr;
        
        const res = typeof rpcData === "string" ? JSON.parse(rpcData) : rpcData;
        if (!res?.success || !res?.user_id) {
          throw new Error(res?.error || "Impossible de créer le compte de connexion.");
        }
        linkedUserId = res.user_id;
      }

      // Extract unique subject names from dialogAssignments to store as school_teachers.subjects
      const subjectsList = Array.from(new Set(dialogAssignments.map(a => a.subject_name).filter(Boolean)));
      const weeksPerMonth = settings?.weeks_per_month || 4.33;

      const payload = {
        first_name: firstName,
        last_name: lastName,
        phone: phone || null,
        email: email || null,
        subjects: subjectsList.length > 0 ? subjectsList : null,
        job_title: jobTitle,
        salary: salary ? parseFloat(salary) : 0,
        placeholder: undefined,
        hire_date: hireDate || null,
        active,
        user_id: linkedUserId,
      };

      let savedTeacherId = "";
      if (editingTeacher) {
        await updateTeacher.mutateAsync({ id: editingTeacher.id, data: payload });
        savedTeacherId = editingTeacher.id;
        toast.success("Professeur mis à jour");
      } else {
        const newTeacher = await createTeacher.mutateAsync(payload);
        savedTeacherId = newTeacher.id;
        toast.success("Professeur ajouté");
      }

      // Save assignments if it is a teacher
      if (savedTeacherId && jobTitle === "Professeur") {
        const weeklyTotal = dialogAssignments.reduce((sum, a) => sum + ((parseFloat(a.hours_per_week) || 4) * (parseFloat(a.hourly_rate) || 500)), 0);
        const computedSalary = Math.round(weeklyTotal * weeksPerMonth);
        const finalSalary = salary ? parseFloat(salary) : computedSalary;

        const assignmentsPayload = await Promise.all(dialogAssignments.map(async (a) => {
          let subjectId = a.subject_id;
          if (!subjectId && a.subject_name.trim()) {
            const subjectObj = await findOrCreateSubjectMutation.mutateAsync(a.subject_name.trim());
            subjectId = subjectObj.id;
          }
          return {
            class_id: a.class_id,
            subject_id: subjectId,
            pay_mode: 'hourly' as const,
            hourly_rate: parseFloat(a.hourly_rate) || 500,
            hours_per_week: parseFloat(a.hours_per_week) || 4,
            monthly_salary: Math.round((parseFloat(a.hours_per_week) || 4) * (parseFloat(a.hourly_rate) || 500) * weeksPerMonth),
          };
        }));

        await saveAssignmentsMutation.mutateAsync({
          teacherId: savedTeacherId,
          assignments: assignmentsPayload,
          totalSalary: finalSalary,
        });
      }

      setIsDialogOpen(false);
      resetForm();
    } catch (error: any) {
      toast.error("Erreur lors de l'enregistrement", { description: error.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Voulez-vous vraiment supprimer ce professeur ?")) return;
    try {
      await deleteTeacher.mutateAsync(id);
      toast.success("Professeur supprimé");
    } catch (error: any) {
      toast.error("Impossible de supprimer");
    }
  };

  // ── Salary calculations
  const weeksPerMonth = settings?.weeks_per_month || 4.33;
  const totalHours = assignments.reduce((sum, a) => sum + (parseFloat(a.hours_per_week) || 0), 0);
  const weeklyTotal = assignments.reduce((sum, a) => sum + ((parseFloat(a.hours_per_week) || 0) * (parseFloat(a.hourly_rate) || 0)), 0);
  const monthlyCalculatedSalary = Math.round(weeklyTotal * weeksPerMonth);

  const handleAddAssignment = () => {
    const teacherSubjects = selectedTeacherForSalary?.subjects || [];
    const firstSubject = catalogSubjects.find(s => s.name === teacherSubjects[0]);
    setAssignments([
      ...assignments,
      {
        class_id: classes[0]?.id || "",
        subject_id: firstSubject?.id || catalogSubjects[0]?.id || "",
        subject_name: firstSubject?.name || catalogSubjects[0]?.name || "",
        hours_per_week: '4',
        hourly_rate: defaultHourlyRate || '500'
      }
    ]);
  };

  const handleRemoveAssignment = (index: number) => {
    const next = [...assignments];
    next.splice(index, 1);
    setAssignments(next);
  };

  const handleAssignmentChange = (index: number, field: keyof UIAssignment, value: any) => {
    const next = [...assignments];
    if (field === 'subject_id') {
      const subject = catalogSubjects.find(s => s.id === value);
      next[index] = { ...next[index], subject_id: value, subject_name: subject?.name || '' };
    } else {
      next[index] = { ...next[index], [field]: value };
    }
    setAssignments(next);
  };

  const handleSaveSalaryConfig = async () => {
    if (!selectedTeacherForSalary) return;
    if (hasDuplicates) {
      toast.error("Des doublons détectés : un professeur ne peut pas enseigner la même matière deux fois dans la même classe.");
      return;
    }
    setIsSavingSalary(true);
    try {
      let finalSalary = 0;
      let assignmentsPayload: any[] = [];

      if (salaryType === 'fixed') {
        finalSalary = Number(fixedSalaryAmount) || 0;
      } else {
        finalSalary = monthlyCalculatedSalary;
        assignmentsPayload = await Promise.all(assignments.map(async (a) => {
          let subjectId = a.subject_id;
          // If subject_id is missing but we have a name, find or create
          if (!subjectId && a.subject_name.trim()) {
            const subjectObj = await findOrCreateSubjectMutation.mutateAsync(a.subject_name.trim());
            subjectId = subjectObj.id;
          }
          if (!subjectId) throw new Error("Veuillez choisir une matière pour chaque ligne");
          return {
            class_id: a.class_id,
            subject_id: subjectId,
            pay_mode: 'hourly',
            hourly_rate: parseFloat(a.hourly_rate) || 0,
            hours_per_week: parseFloat(a.hours_per_week) || 0,
            monthly_salary: Math.round((parseFloat(a.hours_per_week) || 0) * (parseFloat(a.hourly_rate) || 0) * weeksPerMonth),
          };
        }));
      }

      await saveAssignmentsMutation.mutateAsync({
        teacherId: selectedTeacherForSalary.id,
        assignments: assignmentsPayload,
        totalSalary: finalSalary,
      });

      toast.success("Rémunération et assignations enregistrées !");
      setIsSalaryModalOpen(false);
    } catch (error: any) {
      toast.error(error.message || "Erreur lors de l'enregistrement");
    } finally {
      setIsSavingSalary(false);
    }
  };

  // ── Computed lists
  const allSubjectNames = Array.from(new Set(teachers.flatMap(t => t.subjects || []))).sort();
  const filteredTeachers = teachers.filter(t => {
    if (search && !`${t.first_name} ${t.last_name}`.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterSubject !== "all" && !(t.subjects || []).includes(filterSubject)) return false;
    if (filterStatus !== "all" && (filterStatus === "active" ? !t.active : t.active)) return false;
    return true;
  });

  const exportColumns = [
    { header: "Prénom", accessorKey: "first_name" },
    { header: "Nom", accessorKey: "last_name" },
    { header: "Téléphone", accessorKey: "phone", cell: (t: any) => t.phone || "-" },
    { header: "Email", accessorKey: "email", cell: (t: any) => t.email || "-" },
    { header: "Matières", accessorKey: "subjects", cell: (t: any) => t.subjects?.join(", ") || "-" },
    { header: "Salaire Mensuel", accessorKey: "salary", cell: (t: any) => t.salary ? `${t.salary} HTG` : "-" },
    { header: "Actif", accessorKey: "active", cell: (t: any) => t.active ? "Oui" : "Non" },
  ];

  // subjects belonging to this teacher (for assignment dropdown preselection)
  const teacherCatalogSubjects = catalogSubjects.filter(s =>
    selectedTeacherForSalary?.subjects?.includes(s.name)
  );
  // All catalog subjects as options; teacher's own subjects appear first
  const orderedCatalogSubjects = [
    ...teacherCatalogSubjects,
    ...catalogSubjects.filter(s => !teacherCatalogSubjects.find(ts => ts.id === s.id)),
  ];

  return (
    <DashboardLayout role="salon_admin">
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Personnel de l'École</h1>
            <p className="text-muted-foreground">Gérez les dossiers du personnel, leurs fonctions et leurs rémunérations</p>
          </div>

          {/* ── Teacher Info Dialog ─────────────────────────────────── */}
          <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" /> Nouveau Professeur</Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingTeacher ? "Modifier le dossier" : "Ajouter un membre du personnel"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSave} className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Prénom *</Label><Input value={firstName} onChange={e => setFirstName(e.target.value)} required /></div>
                  <div className="space-y-2"><Label>Nom de famille *</Label><Input value={lastName} onChange={e => setLastName(e.target.value)} required /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>{t("common.phone")}</Label><Input value={phone} onChange={e => setPhone(e.target.value)} /></div>
                  <div className="space-y-2"><Label>{t("common.email")}</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} /></div>
                </div>

                {/* Job title / Role */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-1"><Briefcase className="h-3.5 w-3.5" /> Fonction / Rôle</Label>
                  <select
                    value={jobTitle}
                    onChange={e => setJobTitle(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {["Professeur", "Directeur", "Secrétaire", "Informaticien", "Comptable", "Bibliothécaire", "Surveillant", "Agent d'entretien", "Autre"].map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>

                {/* Classes & Subjects Assignment Section */}
                {jobTitle === "Professeur" && (
                  <div className="space-y-3 p-4 border rounded-lg bg-card shadow-sm">
                    <div className="flex items-center justify-between border-b pb-2">
                      <Label className="text-sm font-semibold flex items-center gap-2">
                        <BookOpen className="h-4 w-4 text-primary" /> Classes & Matières Affectées
                      </Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleAddDialogAssignment}
                        className="text-xs"
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" /> Associer un cours
                      </Button>
                    </div>

                    {dialogAssignments.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-4 bg-muted/10 rounded border border-dashed">
                        Aucun cours affecté pour le moment.
                      </p>
                    ) : (
                      <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                        {dialogAssignments.map((a, i) => (
                          <div key={i} className="flex gap-2 items-center bg-muted/10 p-2 rounded border border-border">
                            {/* Class select */}
                            <div className="flex-1 min-w-0">
                              <select
                                value={a.class_id}
                                onChange={e => handleUpdateDialogAssignment(i, 'class_id', e.target.value)}
                                className="w-full h-8 text-xs bg-background border rounded px-1.5 focus:outline-none"
                              >
                                <option value="">-- Classe --</option>
                                {classes.map(c => (
                                  <option key={c.id} value={c.id}>{c.name} {c.section}</option>
                                ))}
                              </select>
                            </div>

                            {/* Subject select */}
                            <div className="flex-1 min-w-0">
                              <select
                                value={a.subject_id}
                                onChange={e => {
                                  const sub = catalogSubjects.find(s => s.id === e.target.value);
                                  handleUpdateDialogAssignment(i, 'subject_id', e.target.value);
                                  if (sub) {
                                    handleUpdateDialogAssignment(i, 'subject_name', sub.name);
                                  }
                                }}
                                className="w-full h-8 text-xs bg-background border rounded px-1.5 focus:outline-none"
                              >
                                <option value="">-- Matière --</option>
                                {catalogSubjects.map(s => (
                                  <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                              </select>
                            </div>

                            {/* Hours / Week */}
                            <div className="w-16 shrink-0">
                              <Input
                                type="number"
                                placeholder="Hrs"
                                value={a.hours_per_week}
                                onChange={e => handleUpdateDialogAssignment(i, 'hours_per_week', e.target.value)}
                                className="h-8 text-xs px-1 text-center"
                              />
                            </div>

                            {/* Delete button */}
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveDialogAssignment(i)}
                              className="h-8 w-8 text-destructive hover:bg-destructive/10"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Salaire Initial Mensuel</Label><Input type="number" step="0.01" value={salary} onChange={e => setSalary(e.target.value)} /></div>
                  <div className="space-y-2"><Label>Date d'embauche</Label><Input type="date" value={hireDate} onChange={e => setHireDate(e.target.value)} /></div>
                </div>
                {/* Connexion Account Section */}
                <div className="p-4 border border-dashed rounded-lg bg-muted/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-semibold">Compte de connexion</Label>
                      <p className="text-xs text-muted-foreground font-sans">
                        {hasLinkedAccount
                          ? "Ce professeur possède déjà un compte utilisateur lié."
                          : "Créer un identifiant et un mot de passe pour le portail enseignant."}
                      </p>
                    </div>
                    {!hasLinkedAccount && (
                      <Switch checked={createAccount} onCheckedChange={setCreateAccount} />
                    )}
                  </div>

                  {(hasLinkedAccount || createAccount) && (
                    <div className="grid grid-cols-2 gap-4 pt-2 border-t border-dashed">
                      <div className="space-y-1">
                        <Label className="text-xs">Nom d'utilisateur</Label>
                        <Input
                          placeholder="Ex: jean.dupont"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          disabled={hasLinkedAccount}
                          required={createAccount}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">
                          {hasLinkedAccount ? "Nouveau mot de passe (Optionnel)" : "Mot de passe"}
                        </Label>
                        <Input
                          type="text"
                          placeholder={hasLinkedAccount ? "Laisser vide si inchangé" : "Saisir un mot de passe"}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required={createAccount && !hasLinkedAccount}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-0.5">
                    <Label>Professeur Actif</Label>
                    <p className="text-sm text-muted-foreground">Est-ce qu'il donne toujours cours ?</p>
                  </div>
                  <Switch checked={active} onCheckedChange={setActive} />
                </div>
                <div className="flex justify-end pt-2">
                  <Button type="submit" disabled={isSaving}>{isSaving ? "Enregistrement..." : "Enregistrer"}</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* ── Salary & Assignments Dialog ──────────────────────────────── */}
        <Dialog open={isSalaryModalOpen} onOpenChange={setIsSalaryModalOpen}>
          <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                Rémunération & Assignations — {selectedTeacherForSalary?.first_name} {selectedTeacherForSalary?.last_name}
                {selectedTeacherForSalary?.job_title && (
                  <span className="ml-2 text-sm font-normal text-muted-foreground">({selectedTeacherForSalary.job_title})</span>
                )}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-6 py-2">
              {/* Mode cards — Horaire only available for Professeur */}
              <div className="space-y-3">
                <Label className="text-base font-semibold">Mode de Rémunération</Label>
                <div className="grid grid-cols-2 gap-4">
                  {(['fixed', 'hourly'] as const).map(mode => {
                    const isHourly = mode === 'hourly';
                    const isTeacher = !selectedTeacherForSalary?.job_title || selectedTeacherForSalary?.job_title === 'Professeur';
                    const disabled = isHourly && !isTeacher;
                    return (
                      <button
                        key={mode}
                        type="button"
                        disabled={disabled}
                        onClick={() => !disabled && setSalaryType(mode)}
                        className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 text-center transition-all ${
                          salaryType === mode
                            ? 'border-primary bg-primary/5 text-primary'
                            : disabled
                            ? 'border-muted bg-muted/20 text-muted-foreground opacity-50 cursor-not-allowed'
                            : 'border-muted bg-background hover:bg-muted/30'
                        }`}
                      >
                        {isHourly ? <Clock className="h-6 w-6 mb-2" /> : <DollarSign className="h-6 w-6 mb-2" />}
                        <span className="font-medium text-sm">{isHourly ? 'Salaire Horaire (par cours)' : 'Salaire Fixe Mensuel'}</span>
                        <span className="text-xs text-muted-foreground mt-1">
                          {isHourly
                            ? (isTeacher ? 'Calculé selon les heures réelles enseignées' : 'Réservé aux professeurs')
                            : 'Un montant plat versé chaque mois'
                          }
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {salaryType === 'fixed' ? (
                <div className="space-y-2 max-w-sm">
                  <Label>Montant du Salaire Mensuel (HTG)</Label>
                  <div className="relative">
                    <Input type="number" placeholder="Ex: 25000" value={fixedSalaryAmount} onChange={e => setFixedSalaryAmount(e.target.value)} className="pr-14 text-lg font-bold" />
                    <div className="absolute right-3 top-2.5 text-sm font-semibold text-muted-foreground">HTG</div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Table header actions */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <Label className="text-base font-semibold">Assignations Classe → Matière</Label>
                      <p className="text-xs text-muted-foreground mt-0.5">Vous pouvez assigner plusieurs matières dans une même classe (ex: Algèbre + Géométrie en 7e).</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Label className="whitespace-nowrap text-xs">Tarif par défaut :</Label>
                      <Input type="number" value={defaultHourlyRate} onChange={e => setDefaultHourlyRate(e.target.value)} className="w-24 h-8 text-right font-medium" />
                      <span className="text-xs text-muted-foreground">HTG/h</span>
                    </div>
                  </div>

                  {/* Duplicate warning */}
                  {hasDuplicates && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      Doublons détectés : une même matière ne peut pas être assignée deux fois dans la même classe pour le même professeur.
                    </div>
                  )}

                  {isLoadingAssignments ? (
                    <div className="text-center py-6 text-sm text-muted-foreground">Chargement...</div>
                  ) : (
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader className="bg-muted/50">
                          <TableRow>
                            <TableHead className="w-[22%]">Classe</TableHead>
                            <TableHead className="w-[28%]">Matière</TableHead>
                            <TableHead className="w-[14%] text-center">H / Sem.</TableHead>
                            <TableHead className="w-[18%]">Tarif (HTG/h)</TableHead>
                            <TableHead className="text-right">Total Hebdo.</TableHead>
                            <TableHead className="w-[48px]" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {assignments.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center py-10 text-muted-foreground text-sm">
                                Aucune assignation. Cliquez sur « Ajouter » pour commencer.
                              </TableCell>
                            </TableRow>
                          ) : (
                            assignments.map((a, i) => {
                              const isDup = duplicates.has(i);
                              return (
                                <TableRow key={i} className={isDup ? "bg-destructive/5" : undefined}>
                                  {/* Class */}
                                  <TableCell>
                                    <select
                                      value={a.class_id}
                                      onChange={e => handleAssignmentChange(i, 'class_id', e.target.value)}
                                      className={`flex h-9 w-full rounded-md border bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${isDup ? 'border-destructive' : 'border-input'}`}
                                    >
                                      {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                  </TableCell>

                                  {/* Subject — dropdown from catalog, teacher's subjects first */}
                                  <TableCell>
                                    <select
                                      value={a.subject_id}
                                      onChange={e => handleAssignmentChange(i, 'subject_id', e.target.value)}
                                      className={`flex h-9 w-full rounded-md border bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${isDup ? 'border-destructive' : 'border-input'}`}
                                    >
                                      <option value="">-- Choisir --</option>
                                      {teacherCatalogSubjects.length > 0 && (
                                        <optgroup label="Matières du professeur">
                                          {teacherCatalogSubjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                        </optgroup>
                                      )}
                                      <optgroup label="Toutes les matières">
                                        {catalogSubjects
                                          .filter(s => !teacherCatalogSubjects.find(ts => ts.id === s.id))
                                          .map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                      </optgroup>
                                    </select>
                                  </TableCell>

                                  {/* Hours */}
                                  <TableCell>
                                    <Input
                                      type="number" min="1"
                                      value={a.hours_per_week}
                                      onChange={e => handleAssignmentChange(i, 'hours_per_week', e.target.value)}
                                      onFocus={e => e.target.select()}
                                      className="h-9 text-center font-medium"
                                    />
                                  </TableCell>

                                  {/* Rate */}
                                  <TableCell>
                                    <div className="relative">
                                      <Input
                                        type="number"
                                        value={a.hourly_rate}
                                        onChange={e => handleAssignmentChange(i, 'hourly_rate', e.target.value)}
                                        onFocus={e => e.target.select()}
                                        className="h-9 text-right pr-6 font-medium"
                                      />
                                      <span className="absolute right-2 top-2 text-xs text-muted-foreground">G</span>
                                    </div>
                                  </TableCell>

                                  {/* Weekly total */}
                                  <TableCell className="text-right font-medium">
                                    {formatAmount((parseFloat(a.hours_per_week) || 0) * (parseFloat(a.hourly_rate) || 0))}
                                  </TableCell>

                                  {/* Delete */}
                                  <TableCell>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => handleRemoveAssignment(i)}>
                                      <Trash className="h-4 w-4" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              );
                            })
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  <Button type="button" variant="outline" size="sm" onClick={handleAddAssignment}>
                    <Plus className="h-4 w-4 mr-2" /> Ajouter une ligne
                  </Button>

                  {/* Summary banner */}
                  {assignments.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-xl bg-primary/5 border border-primary/20 text-center md:text-left">
                      <div className="space-y-1">
                        <span className="text-xs text-muted-foreground block">Heures cumulées / semaine</span>
                        <span className="text-lg font-bold text-primary flex items-center justify-center md:justify-start gap-1">
                          <Clock className="h-4 w-4" /> {totalHours}h
                        </span>
                      </div>
                      <div className="space-y-1">
                        <span className="text-xs text-muted-foreground block">Rémunération hebdomadaire</span>
                        <span className="text-lg font-bold text-primary">{formatAmount(weeklyTotal)}</span>
                      </div>
                      <div className="space-y-1">
                        <span className="text-xs text-muted-foreground block">Salaire mensuel estimé ({weeksPerMonth} sem.)</span>
                        <span className="text-xl font-extrabold text-primary">{formatAmount(monthlyCalculatedSalary)}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 border-t pt-4">
              <Button variant="outline" onClick={() => setIsSalaryModalOpen(false)} disabled={isSavingSalary}>Annuler</Button>
              <Button onClick={handleSaveSalaryConfig} disabled={isSavingSalary || hasDuplicates}>
                {isSavingSalary ? "Enregistrement..." : "Enregistrer"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* ── Filters ─────────────────────────────────────────────────── */}
        <Card className="p-4 bg-muted/30">
          <div className="flex flex-col md:flex-row justify-between gap-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Rechercher par nom..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
              </div>
              <select value={filterSubject} onChange={e => setFilterSubject(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="all">Toutes les matières</option>
                {allSubjectNames.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="all">Tous les statuts</option>
                <option value="active">Actifs</option>
                <option value="inactive">Inactifs</option>
              </select>
            </div>
            <ExportButtons data={filteredTeachers} columns={exportColumns} title="Liste des Professeurs" schoolSettings={settings} academicYearName={activeAcademicYear?.name || null} />
          </div>
        </Card>

        {/* ── Teachers Table ──────────────────────────────────────────── */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Personnel</TableHead>
                  <TableHead>Fonction</TableHead>
                  <TableHead>Matières</TableHead>
                  <TableHead>Salaire Mensuel</TableHead>
                  <TableHead>{t("common.status")}</TableHead>
                  <TableHead className="text-right">{t("common.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8">{t("common.loading")}</TableCell></TableRow>
                ) : filteredTeachers.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Aucun professeur trouvé.</TableCell></TableRow>
                ) : (
                  filteredTeachers.map(teacher => (
                    <TableRow key={teacher.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <UserCheck className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <div>{teacher.first_name} {teacher.last_name}</div>
                            {teacher.phone && <div className="text-xs text-muted-foreground flex items-center mt-0.5"><Phone className="h-3 w-3 mr-1" />{teacher.phone}</div>}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                          <Briefcase className="h-3 w-3" />
                          {teacher.job_title || "Professeur"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {teacher.subjects?.length ? teacher.subjects.map(s => (
                            <span key={s} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-muted text-muted-foreground">{s}</span>
                          )) : <span className="text-muted-foreground text-sm">-</span>}
                        </div>
                      </TableCell>
                      <TableCell className="font-semibold">{teacher.salary ? formatAmount(teacher.salary) : "-"}</TableCell>
                      <TableCell>
                        {teacher.active ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-success/10 text-success">Actif</span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">Inactif</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" title="Salaire & Assignations" onClick={() => { setSelectedTeacherForSalary(teacher); setIsSalaryModalOpen(true); }}>
                          <DollarSign className="h-4 w-4 text-primary" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(teacher)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleDelete(teacher.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
