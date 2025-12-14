// lib/profile.js
import { supabase } from './supabaseClient'

// Fetch the current user’s profile
export async function getProfile() {
  const {
    data: profile,
    error,
  } = await supabase
    .from('profiles')
    .select('id, username, full_name, avatar_url, role')
    .eq('id', supabase.auth.getUser().data.user.id)
    .single()
  if (error) throw error
  return profile
}

// Update (or upsert) the profile fields
export async function updateProfile(updates) {
  const userId = supabase.auth.getUser().data.user.id
  const { error } = await supabase
    .from('profiles')
    .upsert({ id: userId, ...updates, updated_at: new Date() })
  if (error) throw error
}
