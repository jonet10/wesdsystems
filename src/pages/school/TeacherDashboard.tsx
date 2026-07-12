import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";
import { GraduationCap, BookOpen, Clock, Users, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function TeacherDashboard() {
  return (
    <DashboardLayout role="school_teacher" title="Espace Enseignant" subtitle="Bienvenue dans votre espace pédagogique">
      <StaggerContainer>
        <StaggerItem>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
            <Card className="border-0 shadow-sm bg-card">
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">Mes Classes</p>
                    <p className="text-3xl font-bold">4</p>
                  </div>
                  <div className="p-3 bg-primary/10 rounded-xl text-primary">
                    <Users className="w-5 h-5" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm bg-card">
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">Mes Matières</p>
                    <p className="text-3xl font-bold">2</p>
                  </div>
                  <div className="p-3 bg-amber-500/10 rounded-xl text-amber-500">
                    <BookOpen className="w-5 h-5" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm bg-card">
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">Élèves</p>
                    <p className="text-3xl font-bold">142</p>
                  </div>
                  <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-500">
                    <GraduationCap className="w-5 h-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="border-0 shadow-sm bg-card">
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">Heures / Semaine</p>
                    <p className="text-3xl font-bold">18</p>
                  </div>
                  <div className="p-3 bg-indigo-500/10 rounded-xl text-indigo-500">
                    <Clock className="w-5 h-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </StaggerItem>

        <StaggerItem>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="border-0 shadow-sm bg-card">
              <CardHeader>
                <CardTitle>Actions Rapides</CardTitle>
                <CardDescription>Accès direct à vos tâches pédagogiques</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-4">
                <Button variant="outline" className="justify-between h-auto py-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg text-primary">
                      <GraduationCap className="w-4 h-4" />
                    </div>
                    <div className="text-left">
                      <p className="font-semibold">Saisir les Notes</p>
                      <p className="text-xs text-muted-foreground">Interrogations, devoirs, examens</p>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                </Button>
                
                <Button variant="outline" className="justify-between h-auto py-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-500">
                      <Users className="w-4 h-4" />
                    </div>
                    <div className="text-left">
                      <p className="font-semibold">Faire l'Appel (Présences)</p>
                      <p className="text-xs text-muted-foreground">Saisir les retards et absences</p>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                </Button>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm bg-card">
              <CardHeader>
                <CardTitle>Aujourd'hui</CardTitle>
                <CardDescription>Votre emploi du temps</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center gap-4 p-3 rounded-lg border border-border bg-muted/50">
                    <div className="font-bold text-lg text-primary min-w-[60px]">08:00</div>
                    <div>
                      <p className="font-semibold">Mathématiques</p>
                      <p className="text-sm text-muted-foreground">Classe: 7AF - Salle 4</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 p-3 rounded-lg border border-border bg-muted/50">
                    <div className="font-bold text-lg text-primary min-w-[60px]">10:15</div>
                    <div>
                      <p className="font-semibold">Mathématiques</p>
                      <p className="text-sm text-muted-foreground">Classe: NS1 - Salle 2</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </StaggerItem>
      </StaggerContainer>
    </DashboardLayout>
  );
}
