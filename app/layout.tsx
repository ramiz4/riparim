import type { Metadata } from "next";
import "./globals.css";
import "./ui-refresh.css";
import "./auth.css";
import "./catalogue.css";
import "./workshop-pages.css";
import "./ratings.css";
export const metadata: Metadata = {title:"Riparim · Gute Werkstätten in Kosovo finden",description:"Die qualitätsorientierte Werkstattsuche für die Diaspora. Leistungen, Standort und nachvollziehbare Reparaturerfahrungen vergleichen. Direkter Kontakt und Bewertungen nach geprüftem Werkstattbesuch.",icons:{icon:"/riparim-icon-display.png",shortcut:"/riparim-icon-display.png"}};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="de"><body>{children}</body></html>;}
