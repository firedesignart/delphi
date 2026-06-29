import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export async function uploadVideo(file: File, workspaceId: string): Promise<string> {
  const path = `${workspaceId}/videos/${Date.now()}-${file.name}`
  const { error } = await supabase.storage.from('media').upload(path, file)
  if (error) throw error
  return path
}

export function getPublicUrl(path: string): string {
  const { data } = supabase.storage.from('media').getPublicUrl(path)
  return data.publicUrl
}
