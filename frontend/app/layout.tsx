import type { Metadata } from "next";
import "mapbox-gl/dist/mapbox-gl.css";
import "./globals.css";
import AppLayout from "@/components/layout/AppLayout";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import AmbientOrbitVideo from "@/components/layout/AmbientOrbitVideo";

export const metadata: Metadata = {
  title: "TerraTrace | See what changed",
  description:
    "Compare satellite and drone images from different dates, review possible land changes, and explore analysis results on a map.",
  keywords: [
    "satellite change detection",
    "drone inspection",
    "environmental forensics",
    "deforestation monitoring",
    "illegal mining",
    "remote sensing",
    "computer vision",
    "TerraTrace"
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark h-full" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var s=localStorage.getItem('terratrace-theme');if(s){var v=JSON.parse(s);var modes=['midnight','ocean','earth','daylight','high-contrast','auto'];if(modes.indexOf(v.mode)>=0){document.documentElement.dataset.theme=v.mode;if(v.mode==='daylight'||(v.mode==='auto'&&window.matchMedia('(prefers-color-scheme: light)').matches)){document.documentElement.classList.remove('dark');document.documentElement.classList.add('light');}}if(v.reduceMotion!==undefined)document.documentElement.dataset.reduceMotion=String(v.reduceMotion);var a=[10,25,50,75,100],i=a.indexOf(v.intensity);if(i>=0)document.documentElement.style.setProperty('--visual-intensity',String((i+1)/5));}}catch(e){}})();` }} />
      </head>
      <body className="min-h-full antialiased transition-colors duration-300" suppressHydrationWarning>
        <div aria-hidden="true" className="site-background"><AmbientOrbitVideo /></div>
        <div className="relative z-10 min-h-screen">
          <ThemeProvider><AppLayout>{children}</AppLayout></ThemeProvider>
        </div>
      </body>
    </html>
  );
}
