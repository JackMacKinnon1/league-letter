import Navbar from '@/components/Navbar'
import MockDraftSimulator from '@/components/MockDraftSimulator'

export default function MockDraftPage() {
  return (
    <main className="min-h-screen bg-[#0f1724] text-white">
      <Navbar />
      <MockDraftSimulator />
    </main>
  )
}
