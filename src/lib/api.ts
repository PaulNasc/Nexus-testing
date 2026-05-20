import { supabase } from "@/integrations/supabase/client";

/**
 * Nexus API Client
 * This is a bridge between the existing codebase (which uses 'apiClient')
 * and the local database implementation (which mimics the Supabase client).
 */
export const apiClient = supabase;

// For backward compatibility where people might import default
export default apiClient;
