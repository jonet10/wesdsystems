import { useQuery, useMutation, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

/**
 * Hook générique pour récupérer des données sécurisées depuis Supabase
 * @param queryKey Clé unique pour le cache (ex: ['clients'])
 * @param tableName Nom de la table Supabase
 * @param select Colonnes à sélectionner (défaut: '*')
 * @param options Options supplémentaires React Query (ex: { enabled: boolean })
 */
export function useSupabaseQuery<T>(
  queryKey: string[], 
  tableName: string, 
  select = '*', 
  options?: Omit<UseQueryOptions<T[], Error>, 'queryKey' | 'queryFn'>
) {
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
    ...options
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

/**
 * Hook générique pour mettre à jour des données dans Supabase
 */
export function useSupabaseUpdate<T>(tableName: string, queryKeyToInvalidate: string[]) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updateData }: Partial<T> & { id: string }): Promise<T> => {
      const { data, error } = await supabase
        .from(tableName)
        .update(updateData)
        .eq('id', id)
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

/**
 * Hook générique pour supprimer des données dans Supabase
 */
export function useSupabaseDelete(tableName: string, queryKeyToInvalidate: string[]) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq('id', id);

      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeyToInvalidate });
    },
  });
}
