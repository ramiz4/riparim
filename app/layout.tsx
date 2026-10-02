import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {title:"Mjeshtër · Gute Werkstätten in Kosovo finden",description:"Die qualitätsorientierte Werkstattsuche für die Diaspora. Leistungen, Standort und nachvollziehbare Reparaturerfahrungen vergleichen. Private Pilotversion.",icons:{icon:"/favicon.svg",shortcut:"/favicon.svg"}};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="de"><body>{children}</body></html>;}
