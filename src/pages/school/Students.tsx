import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Search, GraduationCap, User as UserIcon, Lock, Unlock } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { ExportButtons } from "@/components/school/ExportButtons";
import { useSchoolSettings } from "@/hooks/useSchoolSettings";
import { useStudents, useCreateStudent, useUpdateStudent, useDeleteStudent, useClasses } from "@/hooks/useSchoolData";
import { supabase } from "@/lib/supabase";
import type { SchoolStudent, SchoolAcademicYear } from "@/modules/school/types";

export default function SchoolStudents() {
  const { user, profile, isAuthenticated } = useAuth();
  const { settings, activeAcademicYear } = useSchoolSettings();
  const businessId = profile?.business_id || user?.user_metadata?.business_id;

  const { data: students = [], isLoading } = useStudents();
  const { data: classes = [] } = useClasses();
  const { data: years = [] } = useQuery({
    queryKey: ["school", "academic-years"],
    queryFn: async () => {
      const { data } = await supabase.from("school_academic_years").select("*").eq("business_id", businessId).order("start_date", { ascending: false });
      return (data || []) as SchoolAcademicYear[];
    },
    enabled: !!businessId,
  });
  const createStudent = useCreateStudent();
  const updateStudent = useUpdateStudent();
  const deleteStudent = useDeleteStudent();

  // Filters
  const [search, setSearch] = useState("");
  const [filterClass, setFilterClass] = useState("all");
  const [filterSection, setFilterSection] = useState("all");
  const [filterGender, setFilterGender] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterYear, setFilterYear] = useState("all");

  useEffect(() => {
    if (filterYear === "all" && activeAcademicYear) {
      setFilterYear(activeAcademicYear.id);
    }
  }, [activeAcademicYear]);

  // Form State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<SchoolStudent | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingMatricule, setIsLoadingMatricule] = useState(false);
  const [matriculeEditable, setMatriculeEditable] = useState(false);

  const initialFormState = {
    matricule: "",
    firstName: "",
    lastName: "",
    gender: "F",
    dob: "",
    birthDepartment: "",
    birthCommune: "",
    birthPlace: "",
    isHandicapped: false,
    handicapType: "",
    shift: "",
    educationLevel: "",
    classLevel: "",
    address: "",
    addressDepartment: "",
    addressCommune: "",
    addressSection: "",
    addressNeighborhood: "",
    phone: "",
    status: "active" as string,
    motherFirstName: "",
    motherLastName: "",
    motherDeceased: false,
    motherProfession: "",
    fatherFirstName: "",
    fatherLastName: "",
    fatherDeceased: false,
    fatherProfession: "",
    respRelationship: "",
    respNif: "",
    respNinu: "",
    respEmail: "",
    respPhone: "",
    respAltPhone: "",
    scholarshipType: "none",
    scholarshipNote: ""
  };

  const [formData, setFormData] = useState(initialFormState);

  const updateField = (field: keyof typeof initialFormState, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const resetForm = () => {
    setEditingStudent(null);
    setFormData(initialFormState);
    setMatriculeEditable(false);
  };

  const generateMatricule = async () => {
    if (!businessId) return;
    setIsLoadingMatricule(true);
    try {
      const { data, error } = await supabase.rpc('generate_school_matricule', {
        p_business_id: businessId
      });
      if (error) throw error;
      if (data) updateField("matricule", data);
    } catch (err: any) {
      // Fallback: generate client-side if RPC not deployed yet
      const year = new Date().getFullYear();
      const rand = Math.floor(1000 + Math.random() * 9000);
      updateField("matricule", `${year}-${rand}`);
    } finally {
      setIsLoadingMatricule(false);
    }
  };

  const handleEdit = (s: SchoolStudent) => {
    setEditingStudent(s);
    setFormData({
      matricule: s.matricule || "",
      firstName: s.first_name,
      lastName: s.last_name,
      gender: s.gender || "F",
      dob: s.dob ? s.dob.split("T")[0] : "",
      birthDepartment: s.birth_department || "",
      birthCommune: s.birth_commune || "",
      birthPlace: s.birth_place || "",
      isHandicapped: s.is_handicapped || false,
      handicapType: s.handicap_type || "",
      shift: s.shift || "",
      educationLevel: s.education_level || "",
      classLevel: s.class_level || "",
      address: s.address || "",
      addressDepartment: s.address_department || "",
      addressCommune: s.address_commune || "",
      addressSection: s.address_section || "",
      addressNeighborhood: s.address_neighborhood || "",
      phone: s.phone || "",
      status: s.status || "active",
      motherFirstName: s.mother_info?.first_name || "",
      motherLastName: s.mother_info?.last_name || "",
      motherDeceased: s.mother_info?.is_deceased || false,
      motherProfession: s.mother_info?.profession || "",
      fatherFirstName: s.father_info?.first_name || "",
      fatherLastName: s.father_info?.last_name || "",
      fatherDeceased: s.father_info?.is_deceased || false,
      fatherProfession: s.father_info?.profession || "",
      respRelationship: s.responsible_person_info?.relationship || "",
      respNif: s.responsible_person_info?.nif || "",
      respNinu: s.responsible_person_info?.ninu || "",
      respEmail: s.responsible_person_info?.email || "",
      respPhone: s.responsible_person_info?.phone || "",
      respAltPhone: s.responsible_person_info?.alt_phone || "",
      scholarshipType: s.scholarship_type || "none",
      scholarshipNote: s.scholarship_note || ""
    });
    setIsDialogOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessId) { toast.error("Erreur de session (businessId manquant)"); return; }
    if (!formData.firstName.trim() || !formData.lastName.trim()) { toast.error("Veuillez saisir le prénom et le nom"); return; }

    setIsSaving(true);
    try {
      const payload = {
        business_id: businessId,
        matricule: formData.matricule || null,
        first_name: formData.firstName,
        last_name: formData.lastName,
        gender: formData.gender,
        dob: formData.dob || null,
        birth_department: formData.birthDepartment || null,
        birth_commune: formData.birthCommune || null,
        birth_place: formData.birthPlace || null,
        is_handicapped: formData.isHandicapped,
        handicap_type: formData.handicapType || null,
        shift: formData.shift || null,
        education_level: formData.educationLevel || null,
        class_level: formData.classLevel || null,
        address: formData.address || null,
        address_department: formData.addressDepartment || null,
        address_commune: formData.addressCommune || null,
        address_section: formData.addressSection || null,
        address_neighborhood: formData.addressNeighborhood || null,
        phone: formData.phone || null,
        status: formData.status,
        mother_info: {
          first_name: formData.motherFirstName,
          last_name: formData.motherLastName,
          is_deceased: formData.motherDeceased,
          profession: formData.motherProfession
        },
        father_info: {
          first_name: formData.fatherFirstName,
          last_name: formData.fatherLastName,
          is_deceased: formData.fatherDeceased,
          profession: formData.fatherProfession
        },
        responsible_person_info: {
          relationship: formData.respRelationship,
          nif: formData.respNif,
          ninu: formData.respNinu,
          email: formData.respEmail,
          phone: formData.respPhone,
          alt_phone: formData.respAltPhone
        },
        scholarship_type: formData.scholarshipType,
        scholarship_note: formData.scholarshipNote || null,
        scholarship_percentage: formData.scholarshipType === 'full' ? 100 : formData.scholarshipType === 'half' ? 50 : 0
      };

      if (editingStudent) {
        await updateStudent.mutateAsync({ id: editingStudent.id, data: payload });
        toast.success("Élève mis à jour");
      } else {
        await createStudent.mutateAsync(payload);
        toast.success("Élève ajouté");
      }

      setIsDialogOpen(false);
      resetForm();
    } catch (error: any) {
      toast.error("Erreur lors de l'enregistrement", { description: error.message });
    } finally {
      setIsSaving(false);
    }
  };

  const filteredStudents = students.filter(s => {
    if (search && !`${s.first_name} ${s.last_name} ${s.matricule}`.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterClass !== "all" && s.class_level !== filterClass) return false;
    if (filterGender !== "all" && s.gender !== filterGender) return false;
    if (filterStatus !== "all" && s.status !== filterStatus) return false;
    return true;
  });

  const exportColumns = [
    { header: "Matricule", accessorKey: "matricule" },
    { header: "Nom Complet", accessorKey: "name", cell: (s: any) => `${s.first_name} ${s.last_name}` },
    { header: "Sexe", accessorKey: "gender" },
    { header: "Classe", accessorKey: "class_level" },
    { header: "Téléphone", accessorKey: "phone" },
    { header: "Statut", accessorKey: "status" },
  ];

  const handleDelete = async (id: string) => {
    if (!confirm("Voulez-vous vraiment supprimer cet élève ?")) return;
    try {
      await deleteStudent.mutateAsync(id);
      toast.success("Élève supprimé");
    } catch (error: any) {
      toast.error("Impossible de supprimer");
    }
  };

  return (
    <DashboardLayout role="salon_admin">
      <div className="space-y-6 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Dossiers des Élèves</h1>
            <p className="text-muted-foreground">Base de données des élèves inscrits dans votre établissement</p>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={async (open) => {
            setIsDialogOpen(open);
            if (!open) {
              resetForm();
            } else if (!editingStudent) {
              // Auto-generate matricule for new students
              await generateMatricule();
            }
          }}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" /> Nouveau Dossier</Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold flex items-center gap-2">
                  <GraduationCap className="h-6 w-6" />
                  {editingStudent ? "Modifier le dossier de l'élève" : "Ajouter un élève"}
                </DialogTitle>
                <p className="text-sm text-red-500">Tous les champs avec un astérisque (*) sont obligatoires</p>
              </DialogHeader>

              <form onSubmit={handleSave} className="space-y-8 pt-4">
                {/* 1. Informations Personnelles */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold border-b pb-2 text-primary flex items-center gap-2">
                    <UserIcon className="h-5 w-5" /> Informations personnelles
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Nom *</Label>
                      <Input value={formData.lastName} onChange={e => updateField("lastName", e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Prénom *</Label>
                      <Input value={formData.firstName} onChange={e => updateField("firstName", e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Sexe *</Label>
                      <div className="flex gap-4 items-center h-10">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="gender" checked={formData.gender === "M"} onChange={() => updateField("gender", "M")} /> Garçon
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="gender" checked={formData.gender === "F"} onChange={() => updateField("gender", "F")} /> Fille
                        </label>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Date de naissance *</Label>
                      <Input type="date" value={formData.dob} onChange={e => updateField("dob", e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Département de la naissance *</Label>
                      <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={formData.birthDepartment} onChange={e => updateField("birthDepartment", e.target.value)}>
                        <option value="">Sélectionner</option>
                        <option value="OUEST">Ouest</option>
                        <option value="NORD">Nord</option>
                        <option value="SUD">Sud</option>
                        <option value="SUD-EST">Sud-Est</option>
                        <option value="NORD-OUEST">Nord-Ouest</option>
                        <option value="NORD-EST">Nord-Est</option>
                        <option value="ARTIBONITE">Artibonite</option>
                        <option value="CENTRE">Centre</option>
                        <option value="GRANDANSE">Grand'Anse</option>
                        <option value="NIPPES">Nippes</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>Commune de la naissance *</Label>
                      <Input value={formData.birthCommune} onChange={e => updateField("birthCommune", e.target.value)} placeholder="Ex: Port-au-Prince" />
                    </div>
                    <div className="space-y-2">
                      <Label>Lieu de naissance</Label>
                      <Input value={formData.birthPlace} onChange={e => updateField("birthPlace", e.target.value)} placeholder="Hôpital, clinique..." />
                    </div>
                    <div className="space-y-2">
                      <Label>Vous êtes handicapé ?</Label>
                      <div className="flex gap-4 items-center h-10">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="handicap" checked={formData.isHandicapped === true} onChange={() => updateField("isHandicapped", true)} /> OUI
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="handicap" checked={formData.isHandicapped === false} onChange={() => updateField("isHandicapped", false)} /> NON
                        </label>
                      </div>
                    </div>
                    {formData.isHandicapped && (
                      <div className="space-y-2">
                        <Label>Quel type de handicap ?</Label>
                        <Input value={formData.handicapType} onChange={e => updateField("handicapType", e.target.value)} placeholder="Visuel, Auditif, Moteur..." />
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. Informations Académiques */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold border-b pb-2 text-primary flex items-center gap-2">
                    <GraduationCap className="h-5 w-5" /> Informations académiques
                  </h3>

                  {/* Matricule (auto-generated) */}
                  <div className="flex items-end gap-2">
                    <div className="space-y-2 flex-1">
                      <Label className="flex items-center gap-1.5">
                        Matricule
                        {!editingStudent && (
                          <span className="text-[10px] bg-primary/10 text-primary font-medium px-1.5 py-0.5 rounded-full">
                            Généré automatiquement
                          </span>
                        )}
                      </Label>
                      <div className="relative">
                        <Input
                          value={isLoadingMatricule ? "Génération..." : formData.matricule}
                          onChange={e => updateField("matricule", e.target.value)}
                          readOnly={!matriculeEditable && !editingStudent}
                          disabled={isLoadingMatricule}
                          placeholder="Ex: 2026-000001"
                          className={!matriculeEditable && !editingStudent ? "bg-muted/40 text-muted-foreground pr-10 font-mono tracking-wide" : "pr-10 font-mono tracking-wide"}
                        />
                        {!editingStudent && (
                          <button
                            type="button"
                            onClick={() => setMatriculeEditable(!matriculeEditable)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1 rounded"
                            title={matriculeEditable ? "Verrouiller" : "Modifier manuellement"}
                          >
                            {matriculeEditable ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                          </button>
                        )}
                      </div>
                    </div>
                    {!editingStudent && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={generateMatricule}
                        disabled={isLoadingMatricule}
                        className="mb-0.5 text-xs shrink-0"
                      >
                        {isLoadingMatricule ? "..." : "↺ Regénérer"}
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Vacation *</Label>
                      <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={formData.shift} onChange={e => updateField("shift", e.target.value)}>
                        <option value="">Sélectionner</option>
                        <option value="AM">Matin (AM)</option>
                        <option value="PM">Soir (PM)</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>Niveau d'enseignement *</Label>
                      <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={formData.educationLevel} onChange={e => { updateField("educationLevel", e.target.value); updateField("classLevel", ""); }}>
                        <option value="">Sélectionner</option>
                        <option value="PRESCOLAIRE">Préscolaire</option>
                        <option value="FONDAMENTAL I">Fondamental I</option>
                        <option value="FONDAMENTAL II">Fondamental II</option>
                        <option value="FONDAMENTAL III">Fondamental III</option>
                        <option value="SECONDAIRE">Secondaire</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>Classe *</Label>
                      <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={formData.classLevel} onChange={e => updateField("classLevel", e.target.value)}>
                        <option value="">Sélectionner une classe...</option>
                        {classes.filter(c => {
                          if (c.active === false) return false;
                          if (!formData.educationLevel) return true;
                          const cycleMap: Record<string, string> = {
                            PRESCOLAIRE: "Préscolaire",
                            "FONDAMENTAL I": "Fondamental 1er Cycle",
                            "FONDAMENTAL II": "Fondamental 2e Cycle",
                            "FONDAMENTAL III": "Fondamental 3e Cycle",
                            SECONDAIRE: "Secondaire Nouveau",
                          };
                          return c.cycle === cycleMap[formData.educationLevel];
                        }).map(c => (
                          <option key={c.id} value={c.code || c.name}>
                            {c.code ? `${c.code} — ${c.name}` : c.name}
                            {c.section ? ` (Section ${c.section})` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Bourse / Scholarship */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-muted/50 mt-4">
                    <div className="space-y-2">
                      <Label>Statut de bourse</Label>
                      <select 
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" 
                        value={formData.scholarshipType} 
                        onChange={e => updateField("scholarshipType", e.target.value)}
                      >
                        <option value="none">Aucune bourse (Plein tarif)</option>
                        <option value="half">Demi-bourse (50% de réduction)</option>
                        <option value="full">Bourse complète (100% de réduction)</option>
                      </select>
                    </div>
                    {formData.scholarshipType !== 'none' && (
                      <div className="space-y-2">
                        <Label>Note / Raison de la bourse</Label>
                        <Input 
                          value={formData.scholarshipNote} 
                          onChange={e => updateField("scholarshipNote", e.target.value)} 
                          placeholder="Ex: Excellence académique, Cas social..." 
                        />
                      </div>
                    )}
                  </div>
                </div>


                {/* 3. Adresse */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold border-b pb-2 text-primary flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    Adresse
                  </h3>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Adresse *</Label>
                      <Input value={formData.address} onChange={e => updateField("address", e.target.value)} placeholder="Rue, numéro..." />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Département *</Label>
                        <Input value={formData.addressDepartment} onChange={e => updateField("addressDepartment", e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>Commune *</Label>
                        <Input value={formData.addressCommune} onChange={e => updateField("addressCommune", e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>Section commune *</Label>
                        <Input value={formData.addressSection} onChange={e => updateField("addressSection", e.target.value)} placeholder="Quartier ou Ville..." />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 4. Parents */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold border-b pb-2 text-primary flex items-center gap-2">
                    <UserIcon className="h-5 w-5" /> Parents
                  </h3>

                  {/* Mère */}
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center bg-muted/20 p-4 rounded-lg">
                    <div className="col-span-1 font-semibold text-sm">Mère</div>
                    <div className="space-y-2 col-span-1">
                      <Label className="text-xs">Nom de la Mère</Label>
                      <Input value={formData.motherLastName} onChange={e => updateField("motherLastName", e.target.value)} />
                    </div>
                    <div className="space-y-2 col-span-1">
                      <Label className="text-xs">Prénom de la Mère</Label>
                      <Input value={formData.motherFirstName} onChange={e => updateField("motherFirstName", e.target.value)} />
                    </div>
                    <div className="space-y-2 col-span-1">
                      <Label className="text-xs">Statut</Label>
                      <div className="flex gap-2">
                        <label className="text-sm cursor-pointer"><input type="radio" checked={formData.motherDeceased} onChange={() => updateField("motherDeceased", true)} /> Décédée</label>
                        <label className="text-sm cursor-pointer"><input type="radio" checked={!formData.motherDeceased} onChange={() => updateField("motherDeceased", false)} /> Vivante</label>
                      </div>
                    </div>
                    <div className="space-y-2 col-span-1">
                      <Label className="text-xs">Profession</Label>
                      <Input value={formData.motherProfession} onChange={e => updateField("motherProfession", e.target.value)} />
                    </div>
                  </div>

                  {/* Père */}
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center bg-muted/20 p-4 rounded-lg">
                    <div className="col-span-1 font-semibold text-sm">Père</div>
                    <div className="space-y-2 col-span-1">
                      <Label className="text-xs">Nom du Père</Label>
                      <Input value={formData.fatherLastName} onChange={e => updateField("fatherLastName", e.target.value)} />
                    </div>
                    <div className="space-y-2 col-span-1">
                      <Label className="text-xs">Prénom du Père</Label>
                      <Input value={formData.fatherFirstName} onChange={e => updateField("fatherFirstName", e.target.value)} />
                    </div>
                    <div className="space-y-2 col-span-1">
                      <Label className="text-xs">Statut</Label>
                      <div className="flex gap-2">
                        <label className="text-sm cursor-pointer"><input type="radio" checked={formData.fatherDeceased} onChange={() => updateField("fatherDeceased", true)} /> Décédé</label>
                        <label className="text-sm cursor-pointer"><input type="radio" checked={!formData.fatherDeceased} onChange={() => updateField("fatherDeceased", false)} /> Vivant</label>
                      </div>
                    </div>
                    <div className="space-y-2 col-span-1">
                      <Label className="text-xs">Profession</Label>
                      <Input value={formData.fatherProfession} onChange={e => updateField("fatherProfession", e.target.value)} />
                    </div>
                  </div>
                </div>

                {/* 5. Personne responsable */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold border-b pb-2 text-primary flex items-center gap-2">
                    <UserIcon className="h-5 w-5" /> Personne responsable
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Lien de parenté *</Label>
                      <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={formData.respRelationship} onChange={e => updateField("respRelationship", e.target.value)}>
                        <option value="">Sélectionner</option>
                        <option value="Mère">Mère</option>
                        <option value="Père">Père</option>
                        <option value="Tuteur">Tuteur / Tutrice</option>
                        <option value="Oncle/Tante">Oncle / Tante</option>
                        <option value="Autre">Autre</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>NIF</Label>
                      <Input value={formData.respNif} onChange={e => updateField("respNif", e.target.value)} placeholder="000-000-000-0" />
                    </div>
                    <div className="space-y-2">
                      <Label>NINU</Label>
                      <Input value={formData.respNinu} onChange={e => updateField("respNinu", e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>E-mail</Label>
                      <Input type="email" value={formData.respEmail} onChange={e => updateField("respEmail", e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Téléphone *</Label>
                      <Input value={formData.respPhone} onChange={e => updateField("respPhone", e.target.value)} placeholder="+509..." />
                    </div>
                    <div className="space-y-2">
                      <Label>Téléphone additionnel</Label>
                      <Input value={formData.respAltPhone} onChange={e => updateField("respAltPhone", e.target.value)} />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-6 border-t mt-8">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Annuler</Button>
                  <Button type="submit" disabled={isSaving} className="bg-green-600 hover:bg-green-700">
                    {isSaving ? "Enregistrement..." : "Soumettre"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="p-4 bg-muted/30">
          <div className="flex flex-col md:flex-row justify-between gap-4">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 flex-1">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Rechercher (Nom, matricule...)" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <select
                value={filterClass}
                onChange={(e) => setFilterClass(e.target.value)}
                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="all">Toutes les classes</option>
                {classes.filter(c => c.active !== false).map(c => (
                  <option key={c.id} value={c.code || c.name}>
                    {c.code ? `${c.code} — ${c.name}` : c.name}
                    {c.section ? ` (Section ${c.section})` : ""}
                  </option>
                ))}
              </select>
              <select
                value={filterGender}
                onChange={(e) => setFilterGender(e.target.value)}
                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="all">Tous les sexes</option>
                <option value="M">Masculin</option>
                <option value="F">Féminin</option>
              </select>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="all">Tous les statuts</option>
                <option value="active">Actif</option>
                <option value="transferred">Transféré</option>
                <option value="graduated">Diplômé</option>
                <option value="dropped_out">Abandon</option>
              </select>
              <select
                value={filterYear}
                onChange={(e) => setFilterYear(e.target.value)}
                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="all">Toutes les années</option>
                {years.map(y => (
                  <option key={y.id} value={y.id}>{y.name} {y.active ? "(Active)" : ""}</option>
                ))}
              </select>
            </div>
            <ExportButtons
              data={filteredStudents}
              columns={exportColumns}
              title="Liste des Élèves"
              schoolSettings={settings}
              academicYearName={years.find(y => y.id === filterYear)?.name || activeAcademicYear?.name || null}
            />
          </div>
        </Card>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Élève</TableHead>
                  <TableHead>Sexe</TableHead>
                  <TableHead>Classe / Niveau</TableHead>
                  <TableHead>Téléphone Resp.</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8">Chargement...</TableCell></TableRow>
                ) : filteredStudents.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Aucun élève trouvé.</TableCell></TableRow>
                ) : (
                  filteredStudents.map((student) => (
                    <TableRow key={student.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center mr-3">
                            <GraduationCap className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <div>{student.first_name} {student.last_name}</div>
                            {student.matricule && <div className="text-xs text-muted-foreground">Matricule: {student.matricule}</div>}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{student.gender === "M" ? "M" : "F"}</TableCell>
                      <TableCell className="text-muted-foreground">{student.class_level || "-"}</TableCell>
                      <TableCell className="text-muted-foreground">{student.responsible_person_info?.phone || student.phone || "-"}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(student)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleDelete(student.id)}>
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
