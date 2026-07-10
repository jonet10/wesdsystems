import React, { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Save, FileSpreadsheet, RefreshCw, AlertCircle, Upload, Download, Settings } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { ClassCurriculumDialog } from "./ClassCurriculumDialog";

interface BulkGradesGridProps {
  businessId: string;
  academicYearId: string;
  classId: string;
  periodName: string;
}

interface Domain {
  id: string;
  name: string;
  display_order: number;
}

interface Subject {
  id: string;
  name: string;
  domain_id: string | null;
  coefficient: number;
}

export function BulkGradesGrid({ businessId, academicYearId, classId, periodName }: BulkGradesGridProps) {
  const [students, setStudents] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [exams, setExams] = useState<any[]>([]);
  const [gradesMap, setGradesMap] = useState<Record<string, Record<string, string>>>({}); // studentId -> { examId -> points_obtained }
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [schoolName, setSchoolName] = useState("");
  const [className, setClassName] = useState("");

  const [isCurriculumDialogOpen, setIsCurriculumDialogOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!classId || !periodName || !academicYearId) return;
    fetchData();
  }, [classId, periodName, academicYearId]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch Business Name
      const { data: biz } = await supabase.from("businesses").select("name").eq("id", businessId).single();
      if (biz) setSchoolName(biz.name);

      // Fetch Class Name
      const { data: cls } = await supabase.from("school_classes").select("name").eq("id", classId).single();
      if (cls) setClassName(cls.name);

      // 1. Fetch Students
      const { data: enrollments } = await supabase
        .from("school_enrollments")
        .select("student_id, student:school_students(id, first_name, last_name, matricule)")
        .eq("class_id", classId)
        .in("status", ["registered", "active"]);
      
      const stds = (enrollments || []).map((e: any) => e.student).sort((a: any, b: any) => 
        `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`)
      );
      setStudents(stds);

      // 2. Fetch Domains
      const { data: domainData } = await supabase
        .from("school_subject_domains")
        .select("*")
        .eq("business_id", businessId)
        .order("display_order", { ascending: true });
      setDomains(domainData || []);

      // 3. Fetch Subjects & Coefficients for this class
      const { data: coefData } = await supabase
        .from("school_class_subject_coefficients")
        .select("subject_id, coefficient, domain_id, subject:school_subjects(id, name)")
        .eq("class_id", classId);
      
      let subjs: Subject[] = [];
      if (coefData && coefData.length > 0) {
        subjs = coefData.map((c: any) => ({
          id: c.subject.id,
          name: c.subject.name,
          domain_id: c.domain_id,
          coefficient: Number(c.coefficient || 10)
        }));
      } else {
        // Fallback
        const { data: classSubjects } = await supabase
          .from("school_subject_classes")
          .select("subject:school_subjects(id, name)")
          .eq("class_id", classId);
        subjs = (classSubjects || []).map((sc: any) => ({
          id: sc.subject.id,
          name: sc.subject.name,
          domain_id: null,
          coefficient: 10
        })).filter(s => s.id);
      }
      setSubjects(subjs);

      // 4. Fetch Exams
      const { data: existingExams } = await supabase
        .from("school_exams")
        .select("*")
        .eq("class_id", classId)
        .eq("academic_year_id", academicYearId)
        .eq("name", periodName);
      
      setExams(existingExams || []);

      // 5. Fetch grades
      const examIds = (existingExams || []).map((e: any) => e.id);
      let gMap: Record<string, Record<string, string>> = {};
      
      if (examIds.length > 0) {
        const { data: grades } = await supabase
          .from("school_grades")
          .select("*")
          .in("exam_id", examIds);
        
        (grades || []).forEach((g: any) => {
          if (!gMap[g.student_id]) gMap[g.student_id] = {};
          gMap[g.student_id][g.exam_id] = String(g.points_obtained);
        });
      }
      setGradesMap(gMap);

    } catch (error: any) {
      toast.error("Erreur: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateExams = async () => {
    setIsLoading(true);
    try {
      const existingSubjectIds = exams.map(e => e.subject_id);
      const missingSubjects = subjects.filter(s => !existingSubjectIds.includes(s.id));
      
      if (missingSubjects.length === 0) {
        toast.info("Déjà généré.");
        setIsLoading(false);
        return;
      }

      const newExams = missingSubjects.map(s => ({
        business_id: businessId,
        class_id: classId,
        subject_id: s.id,
        academic_year_id: academicYearId,
        name: periodName,
        max_points: s.coefficient * 10,
        coefficient: s.coefficient,
        exam_date: new Date().toISOString().split('T')[0]
      }));

      const { error } = await supabase.from("school_exams").insert(newExams);
      if (error) throw error;
      
      toast.success("Généré avec succès !");
      fetchData();
    } catch (error: any) {
      toast.error("Erreur: " + error.message);
      setIsLoading(false);
    }
  };

  const handleGradeChange = (studentId: string, examId: string, value: string) => {
    setGradesMap(prev => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || {}),
        [examId]: value
      }
    }));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, rowIndex: number, colIndex: number) => {
    const table = document.getElementById("bulk-grades-table");
    if (!table) return;

    let targetRow = rowIndex;
    let targetCol = colIndex;

    switch (e.key) {
      case "ArrowUp": targetRow -= 1; break;
      case "ArrowDown": case "Enter": targetRow += 1; break;
      case "ArrowLeft": targetCol -= 1; break;
      case "ArrowRight": case "Tab": targetCol += 1; break;
      default: return;
    }

    if (e.key === "Tab") e.preventDefault();

    if (targetRow < 0) targetRow = 0;
    if (targetRow >= students.length) targetRow = students.length - 1;
    if (targetCol < 0) targetCol = 0;
    if (targetCol >= exams.length) targetCol = exams.length - 1;

    const inputId = `grade-input-${targetRow}-${targetCol}`;
    const nextInput = document.getElementById(inputId);
    if (nextInput) {
      nextInput.focus();
      (nextInput as HTMLInputElement).select();
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const gradesToUpsert: any[] = [];
      Object.keys(gradesMap).forEach(studentId => {
        Object.keys(gradesMap[studentId]).forEach(examId => {
          const val = gradesMap[studentId][examId];
          if (val && val.trim() !== "") {
            gradesToUpsert.push({
              business_id: businessId,
              student_id: studentId,
              exam_id: examId,
              points_obtained: Number(val),
            });
          }
        });
      });

      if (gradesToUpsert.length === 0) {
        setIsSaving(false); return;
      }

      const { error } = await supabase.from("school_grades").upsert(gradesToUpsert, { onConflict: 'exam_id, student_id' });
      if (error) throw error;
      toast.success(`${gradesToUpsert.length} notes enregistrées !`);
    } catch (error: any) {
      toast.error("Erreur: " + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const getGroupedExams = () => {
    const grouped: { domain: Domain | null, exams: any[] }[] = [];
    const unassignedExams = exams.filter(e => {
      const subj = subjects.find(s => s.id === e.subject_id);
      return !subj || !subj.domain_id;
    });

    domains.forEach(d => {
      const domainExams = exams.filter(e => {
        const subj = subjects.find(s => s.id === e.subject_id);
        return subj && subj.domain_id === d.id;
      });
      if (domainExams.length > 0) grouped.push({ domain: d, exams: domainExams });
    });

    if (unassignedExams.length > 0) grouped.push({ domain: null, exams: unassignedExams });
    return grouped;
  };

  const groupedExams = getGroupedExams();

  const handleExportExcel = () => {
    if (students.length === 0 || exams.length === 0) return;

    const aoa: any[][] = [];
    aoa.push([schoolName]);
    aoa.push([`Année: ${periodName}`, `Classe: ${className}`]);
    aoa.push([]);

    const domainRow: any[] = ["ID", "Nom et Prenom"];
    const subjectRow: any[] = ["", ""];
    const merges: XLSX.Range[] = [];
    let colIndex = 2;

    groupedExams.forEach(group => {
      const domainName = group.domain ? group.domain.name : "Autres";
      domainRow[colIndex] = domainName;
      merges.push({ s: { r: 3, c: colIndex }, e: { r: 3, c: colIndex + group.exams.length - 1 } });
      
      for (let i = 1; i < group.exams.length; i++) domainRow.push(null);

      group.exams.forEach(exam => {
        const subj = subjects.find(s => s.id === exam.subject_id);
        subjectRow[colIndex] = subj?.name || "Inconnu";
        colIndex++;
      });
    });

    aoa.push(domainRow);
    aoa.push(subjectRow);

    students.forEach(student => {
      const row: any[] = [student.id, `${student.first_name} ${student.last_name}`];
      groupedExams.forEach(group => {
        group.exams.forEach(exam => {
          row.push(gradesMap[student.id]?.[exam.id] || "");
        });
      });
      aoa.push(row);
    });

    const worksheet = XLSX.utils.aoa_to_sheet(aoa);
    worksheet["!merges"] = merges;
    worksheet["!cols"] = [ { wch: 15 }, { wch: 30 } ]; 
    for (let i=2; i<colIndex; i++) worksheet["!cols"].push({ wch: 15 });

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Notes");
    XLSX.writeFile(workbook, `Notes_${className}_${periodName}.xlsx`);
    toast.success("Fichier Excel généré !");
  };

  const normalizeString = (str: string) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const workbook = XLSX.read(bstr, { type: 'binary' });
        const worksheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[worksheetName];
        
        const aoa: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        let headerRowIndex = -1;
        let nameColIndex = -1;
        let idColIndex = -1;

        for (let r = 0; r < aoa.length; r++) {
          const row = aoa[r];
          if (!row) continue;
          for (let c = 0; c < row.length; c++) {
            const cell = String(row[c] || "").toLowerCase();
            if (cell.includes("nom et prenom") || cell.includes("nom") || cell.includes("eleve")) {
              headerRowIndex = r;
              nameColIndex = c;
              for (let i = 0; i < c; i++) {
                if (String(row[i] || "").toLowerCase().includes("id")) {
                  idColIndex = i; break;
                }
              }
              break;
            }
          }
          if (headerRowIndex !== -1) break;
        }

        if (headerRowIndex === -1) {
          toast.error("Ligne Nom et Prenom introuvable.");
          return;
        }

        const headerRow = aoa[headerRowIndex];
        const colToExamMap: Record<number, string> = {};

        headerRow.forEach((colName, cIndex) => {
          if (!colName || cIndex === nameColIndex || cIndex === idColIndex) return;
          const normalizedCol = normalizeString(String(colName));
          const matchedExam = exams.find(ex => {
            const subj = subjects.find(s => s.id === ex.subject_id);
            if (!subj) return false;
            return normalizeString(subj.name) === normalizedCol;
          });
          if (matchedExam) colToExamMap[cIndex] = matchedExam.id;
        });

        let importedCount = 0;
        const newGradesMap = { ...gradesMap };

        for (let r = headerRowIndex + 1; r < aoa.length; r++) {
          const row = aoa[r];
          if (!row || !row[nameColIndex]) continue;
          let studentId = idColIndex !== -1 ? row[idColIndex] : null;
          const studentName = String(row[nameColIndex]);

          if (!studentId) {
            const matchedStudent = students.find(s => normalizeString(`${s.first_name} ${s.last_name}`) === normalizeString(studentName));
            if (matchedStudent) studentId = matchedStudent.id;
          }
          if (!studentId) continue; 
          if (!newGradesMap[studentId]) newGradesMap[studentId] = {};

          Object.keys(colToExamMap).forEach(cIndexStr => {
            const cIndex = Number(cIndexStr);
            const examId = colToExamMap[cIndex];
            const gradeValue = String(row[cIndex]);
            if (gradeValue && gradeValue.trim() !== "" && gradeValue !== "undefined") {
              newGradesMap[studentId][examId] = gradeValue;
              importedCount++;
            }
          });
        }
        setGradesMap(newGradesMap);
        toast.success(`${importedCount} notes prêtes à enregistrer.`);
      } catch (error: any) {
        toast.error("Erreur import: " + error.message);
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsBinaryString(file);
  };

  if (!classId) return <div className="p-4 text-center">Sélectionnez une classe.</div>;

  let flatColIndex = 0;

  return (
    <div className="space-y-4 mt-6">
      <div className="flex flex-wrap items-center justify-between gap-4 bg-muted/30 p-4 rounded-lg border border-border">
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportExcel} disabled={exams.length === 0}>
            <Download className="mr-2 h-4 w-4" /> Exporter Modèle Excel
          </Button>
          <div className="relative">
            <input type="file" accept=".xlsx, .xls" className="hidden" ref={fileInputRef} onChange={handleImportExcel} />
            <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={exams.length === 0}>
              <Upload className="mr-2 h-4 w-4" /> Importer Notes Excel
            </Button>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsCurriculumDialogOpen(true)}>
            <Settings className="mr-2 h-4 w-4" /> Configurer le Programme
          </Button>
          {exams.length < subjects.length && (
             <Button variant="secondary" onClick={handleGenerateExams} disabled={isLoading}>
               <AlertCircle className="mr-2 h-4 w-4 text-amber-500" /> Générer
             </Button>
          )}
          <Button onClick={handleSave} disabled={isSaving || exams.length === 0}>
            {isSaving ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Enregistrer
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="p-8 text-center"><RefreshCw className="h-8 w-8 animate-spin mx-auto text-muted-foreground" /></div>
      ) : exams.length === 0 ? (
        <div className="text-center p-12 border border-dashed rounded-lg bg-card">
          <FileSpreadsheet className="h-12 w-12 mx-auto text-muted-foreground mb-4 opacity-20" />
          <h3 className="text-lg font-medium mb-2">Aucune colonne</h3>
          <div className="flex justify-center gap-4 mt-4">
            <Button variant="outline" onClick={() => setIsCurriculumDialogOpen(true)}>
              <Settings className="mr-2 h-4 w-4" /> Configurer le Programme
            </Button>
            <Button onClick={handleGenerateExams}>Générer les colonnes ({subjects.length} matières)</Button>
          </div>
        </div>
      ) : (
        <div className="border rounded-lg overflow-x-auto bg-card shadow-sm">
          <Table id="bulk-grades-table">
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="w-[250px] min-w-[200px] sticky left-0 bg-muted/90 backdrop-blur z-20 border-r" rowSpan={2}>Élève</TableHead>
                {groupedExams.map((group, i) => (
                  <TableHead key={i} colSpan={group.exams.length} className="text-center border-r bg-muted/80 font-bold border-b text-primary uppercase text-xs">
                    {group.domain ? group.domain.name : "Autres Matières"}
                  </TableHead>
                ))}
              </TableRow>
              <TableRow>
                {groupedExams.map((group) => (
                  group.exams.map(exam => {
                    const subject = subjects.find(s => s.id === exam.subject_id);
                    return (
                      <TableHead key={exam.id} className="min-w-[100px] text-center border-r font-semibold p-2 bg-muted/30">
                        {subject?.name || 'Inconnu'}<br/>
                        <span className="text-[9px] font-normal text-muted-foreground">Max: {exam.max_points}</span>
                      </TableHead>
                    );
                  })
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.map((student, rowIndex) => {
                let colIndexCursor = 0;
                return (
                  <TableRow key={student.id} className="hover:bg-muted/30">
                    <TableCell className="font-medium sticky left-0 bg-card z-10 border-r truncate text-xs">
                      {student.first_name} {student.last_name}
                    </TableCell>
                    {groupedExams.map((group) => {
                      return group.exams.map((exam) => {
                        const colIdx = colIndexCursor++;
                        return (
                          <TableCell key={exam.id} className="p-0 border-r text-center">
                            <Input
                              id={`grade-input-${rowIndex}-${colIdx}`}
                              type="number"
                              className="h-9 w-full text-center border-transparent hover:border-input focus:border-primary px-1 font-mono rounded-none text-xs"
                              value={gradesMap[student.id]?.[exam.id] || ""}
                              onChange={(e) => handleGradeChange(student.id, exam.id, e.target.value)}
                              onKeyDown={(e) => handleKeyDown(e, rowIndex, colIdx)}
                            />
                          </TableCell>
                        );
                      });
                    })}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Raccourci vers la configuration */}
      <ClassCurriculumDialog
        open={isCurriculumDialogOpen}
        onOpenChange={(open) => {
          setIsCurriculumDialogOpen(open);
          if (!open) {
            fetchData(); // Refresh grid when dialog closes
          }
        }}
        classId={classId}
        className={className}
        businessId={businessId}
      />
    </div>
  );
}
