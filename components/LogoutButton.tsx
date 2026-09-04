'use client'

import { LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function LogoutButton() {
  const supabase = createClient()

  async function logout() {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  return (
    <button onClick={logout} className="ll-nav-link ll-logout-button" type="button">
      <LogOut size={15} />
      <span>Sign out</span>
    </button>
  )
}
