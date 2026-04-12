/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Only initialize if keys are present to avoid crashing on startup
export const supabase = (supabaseUrl && supabaseAnonKey) 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;

export interface IntelligenceRecord {
  id?: string;
  created_at?: string;
  label: string;
  coordinates: string;
  content: string;
  telemetry: string;
  score: number;
  divergence_score: number;
  is_buildup: boolean;
  metadata?: any;
}

export async function saveToArchive(record: IntelligenceRecord) {
  if (!supabase) return null;
  
  const { data, error } = await supabase
    .from('intelligence_archive')
    .insert([record])
    .select();
    
  if (error) {
    console.error('Supabase Archive Error:', error);
    return null;
  }
  return data?.[0];
}

export async function getHistoricalContext(limit = 5) {
  if (!supabase) return [];
  
  const { data, error } = await supabase
    .from('intelligence_archive')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
    
  if (error) {
    console.error('Supabase Fetch Error:', error);
    return [];
  }
  return data || [];
}

export async function updateArchiveRecord(id: string, additionalContent: string) {
  if (!supabase) return null;
  
  const { data: existing } = await supabase
    .from('intelligence_archive')
    .select('content')
    .eq('id', id)
    .single();
    
  if (!existing) return null;

  const newContent = existing.content + '\n\n' + additionalContent;

  const { data, error } = await supabase
    .from('intelligence_archive')
    .update({ content: newContent })
    .eq('id', id)
    .select();
    
  if (error) {
    console.error('Supabase Update Error:', error);
    return null;
  }
  return data?.[0];
}
