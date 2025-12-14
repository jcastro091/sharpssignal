import { useEffect, useState } from 'react'
import Link from 'next/link'

function Footer() {
  const [year, setYear] = useState('2025')

  useEffect(() => {
    setYear(new Date().getFullYear())
  }, [])

  return (
    <footer className="bg-gray-100 py-8">
      <div className="container mx-auto px-6 text-center space-y-2 text-sm text-gray-600">
        <Link href="mailto:support@sharpsignal.com" className="text-indigo-600 hover:underline">
          SharpSignal@gmail.com
        </Link>
        <p>© {year} SharpSignal. All rights reserved.</p>
        <div className="space-x-4">
          <Link href="/about" className="text-indigo-600 hover:underline">About & Contact</Link>
          <Link href="/legal#terms" className="text-indigo-600 hover:underline">📜 Terms</Link>
          <Link href="/legal#privacy" className="text-indigo-600 hover:underline">🔐 Privacy</Link>
        </div>
      </div>
    </footer>
  )
}

export default Footer
