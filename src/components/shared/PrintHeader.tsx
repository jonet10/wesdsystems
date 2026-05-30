import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

interface BusinessProfile {
  name: string;
  phone: string;
  email: string;
  address: string;
  logo_url?: string;
  slogan?: string;
}

export function PrintHeader() {
  const { user } = useAuth();
  const [business, setBusiness] = useState<BusinessProfile | null>(null);

  useEffect(() => {
    const fetchBusinessInfo = async () => {
      if (!user) return;
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('business_id')
          .eq('id', user.id)
          .maybeSingle();

        if (profile?.business_id) {
          const { data: biz } = await supabase
            .from('businesses')
            .select('*')
            .eq('id', profile.business_id)
            .maybeSingle();
            
          if (biz) {
            setBusiness({
              name: biz.name || "GlowUp Salon",
              phone: biz.phone_number || "+33 6 12 34 56 78",
              email: biz.email || "contact@glowup.com",
              address: biz.address || "15 Rue de la Paix, 75002 Paris",
              logo_url: biz.logo_url,
              slogan: "L'excellence à votre service"
            });
          }
        }
      } catch (error) {
        console.error("Erreur lors de la récupération des infos d'impression:", error);
      }
    };
    fetchBusinessInfo();
  }, [user]);

  if (!business) return null;

  return (
    <div className="hidden print:flex flex-col items-center justify-center w-full pb-8 mb-8 border-b-2 border-black">
      <div className="flex items-center justify-between w-full">
        {business.logo_url ? (
          <img src={business.logo_url} alt="Logo" className="h-16 w-16 object-contain" />
        ) : (
          <div className="h-16 w-16 bg-gray-200 flex items-center justify-center font-bold text-gray-500 rounded-lg">
            {business.name.charAt(0)}
          </div>
        )}
        <div className="text-right">
          <h1 className="text-2xl font-bold font-display text-black m-0 p-0">{business.name}</h1>
          {business.slogan && <p className="text-sm italic text-gray-700 m-0 p-0">{business.slogan}</p>}
        </div>
      </div>
      <div className="flex justify-between w-full mt-4 text-sm text-gray-800">
        <div>
          <p><strong>Adresse:</strong> {business.address}</p>
        </div>
        <div className="text-right">
          <p><strong>Tel:</strong> {business.phone}</p>
          <p><strong>Email:</strong> {business.email}</p>
        </div>
      </div>
      <div className="w-full text-right mt-4 text-xs text-gray-500">
        Imprimé le : {new Date().toLocaleDateString("fr-FR")} à {new Date().toLocaleTimeString("fr-FR", { hour: '2-digit', minute: '2-digit' })}
      </div>
    </div>
  );
}
