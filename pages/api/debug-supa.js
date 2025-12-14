import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  {
    db: { schema: 'public' } // ✅ schema override
  }
)

export default async function handler(req, res) {
  const { error } = await supabase
    .from('email_signups')
    .insert([{ email: 'debug@example.com' }])

  if (error) {
    console.error('Supabase insert error:', error)
    return res.status(500).json({ error })
  }

  return res.status(200).json({ success: true })
}
