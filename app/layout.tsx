import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PulseWire",
  description: "Status page for whether you need the news.",
  manifest: "/manifest.webmanifest",
  themeColor: "#141414",
  appleWebApp: {
    capable: true,
    title: "PulseWire",
    statusBarStyle: "default",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('pulsewire-theme');if(t==='night'||(t!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('night');}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
