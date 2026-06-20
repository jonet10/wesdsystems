import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "./useAuth";
import type { SchoolSetting, SchoolAcademicYear } from "@/modules/school/types";

export function useSchoolSettings() {
  const { profile, user, isAuthenticated } = useAuth();
  const businessId = profile?.business_id || user?.user_metadata?.business_id;
  
  const [settings, setSettings] = useState<SchoolSetting | null>(null);
  const [activeAcademicYear, setActiveAcademicYear] = useState<SchoolAcademicYear | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated || !businessId) {
      setIsLoading(false);
      return;
    }

    const fetchSettings = async () => {
      try {
        const [settingsRes, yearRes] = await Promise.all([
          supabase
            .from("school_settings")
            .select("*")
            .eq("business_id", businessId)
            .maybeSingle(),
          supabase
            .from("school_academic_years")
            .select("*")
            .eq("business_id", businessId)
            .eq("active", true)
            .order("created_at", { ascending: false })
            .maybeSingle()
        ]);

        if (settingsRes.data) setSettings(settingsRes.data);
        if (yearRes.data) setActiveAcademicYear(yearRes.data);
      } catch (error) {
        console.error("Failed to load school settings", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSettings();
  }, [businessId, isAuthenticated]);

  return { settings, activeAcademicYear, isLoading };
}
