import type { Metadata } from 'next'
import { Suspense } from 'react'
import RouteProgress from '@/components/RouteProgress'
import './globals.css'

export const metadata: Metadata = {
  title: 'League Letter',
  description: 'Fantasy football league newsletter powered by Sleeper',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>
        <Suspense fallback={null}>
          <RouteProgress />
        </Suspense>
        {children}
      </body>
    </html>
  )
}