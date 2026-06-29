import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Delphi — Create. Edit. Publish. Grow.',
  description: 'Motor de produção automatizada de YouTube Shorts com IA',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}
