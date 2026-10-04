import type { Metadata } from "next";
import {ThemeProvider} from "@/components/theme-provider";
import "./globals.css";
import "./ui-refresh.css";
import "./auth.css";
import "./catalogue.css";
import "./workshop-pages.css";
import "./ratings.css";
import "./form-controls.css";
import "./theme.css";
export const metadata: Metadata = {title:"Riparim · Gute Werkstätten in Kosovo finden",description:"Die qualitätsorientierte Werkstattsuche für die Diaspora. Leistungen, Standort und nachvollziehbare Reparaturerfahrungen vergleichen. Direkter Kontakt und Bewertungen nach geprüftem Werkstattbesuch.",icons:{icon:"/riparim-icon-display.png",shortcut:"/riparim-icon-display.png"}};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="de" suppressHydrationWarning><body><ThemeProvider>{children}</ThemeProvider></body></html>;}
