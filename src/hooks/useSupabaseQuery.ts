import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

/**
 * Hook générique pour récupérer des données sécurisées depuis Supabase
 * @param queryKey Clé unique pour le cache (ex: ['clients'])
 * @param tableName Nom de la table Supabase
 * @param select Colonnes à sélectionner (défaut: '*')
 */
export function useSupabaseQuery<T>(queryKey: string[], tableName: string, select = '*') {
  return useQuery({
    queryKey,
    queryFn: async (): Promise<T[]> => {
      const { data, error } = await supabase
        .from(tableName)
        .select(select);

      if (error) {
        console.error(`Erreur lors du fetch de ${tableName}:`, error.message);
        throw new Error(error.message);
      }

      return data as T[];
    },
  });
}

/**
 * Hook générique pour insérer des données sécurisées dans Supabase
 * @param tableName Nom de la table Supabase
 * @param queryKeyToInvalidate Clé à invalider dans le cache après insertion (ex: ['clients'])
 */
export function useSupabaseInsert<T>(tableName: string, queryKeyToInvalidate: string[]) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (newData: Partial<T>): Promise<T> => {
      // Pour une insertion, on récupère le profil actif pour obtenir le business_id
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Utilisateur non authentifié");

      const { data: profile } = await supabase
        .from('profiles')
        .select('business_id')
        .eq('id', user.id)
        .single();

      if (!profile?.business_id) {
        throw new Error("L'utilisateur n'est lié à aucune entreprise valide");
      }

      const { data, error } = await supabase
        .from(tableName)
        .insert([{ ...newData, business_id: profile.business_id }])
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data as T;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeyToInvalidate });
    },
  });
}
