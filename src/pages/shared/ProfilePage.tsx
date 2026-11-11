import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";
import { AccountSecuritySettings } from "@/components/settings/AccountSecuritySettings";

export default function ProfilePage() {
  return (
    <DashboardLayout 
      title="Mon Profil & Sécurité" 
      subtitle="Gestion de vos identifiants d'accès, mot de passe et adresse email de connexion"
    >
      <StaggerContainer className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
        <StaggerItem>
          <AccountSecuritySettings />
        </StaggerItem>
      </StaggerContainer>
    </DashboardLayout>
  );
}
