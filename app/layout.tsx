import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AccessCheck — Free ADA Website Checker & WCAG Compliance Tool',
  description: 'Free ADA website checker. Instantly scan any URL for WCAG 2.1 accessibility violations. AI-powered fix instructions included. No signup required.',
  keywords: ['free ADA website checker', 'WCAG checker', 'ADA compliance checker', 'website accessibility audit', 'WCAG 2.1 checker', 'accessibility compliance tool'],
  openGraph: {
    title: 'AccessCheck — Free ADA Website Checker',
    description: 'Scan your website for ADA/WCAG 2.1 compliance in 60 seconds. Free. No signup.',
    type: 'website',
  },
  alternates: {
    canonical: 'https://accesscheck.app',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <style>{`
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: system-ui, -apple-system, sans-serif; background: #f8fafc; color: #1e293b; line-height: 1.6; }
          a { color: #2563eb; text-decoration: none; }
          a:hover { text-decoration: underline; }
        `}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
