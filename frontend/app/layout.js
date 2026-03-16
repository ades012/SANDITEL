// frontend/app/layout.js
export const metadata = {
  title: 'Sanditel Web',
  description: 'Monitoring Aplikasi Divisi Sanditel',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0 }}>{children}</body>
    </html>
  )
}