import type { Metadata } from "next";
import "./globals.css";
import "./ui-refresh.css";
export const metadata: Metadata = {title:"Mjeshtër · Gute Werkstätten in Kosovo finden",description:"Die qualitätsorientierte Werkstattsuche für die Diaspora. Leistungen, Standort und nachvollziehbare Reparaturerfahrungen vergleichen. Direkter Kontakt und Bewertungen nach geprüftem Werkstattbesuch.",icons:{icon:"/logo.png",shortcut:"/logo.png"}};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="de"><body>{children}</body></html>;}
