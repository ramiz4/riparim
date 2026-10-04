"use client";
import {useState} from "react";
import Link from "next/link";
import {ChevronRight,FileCheck2,LockKeyhole,Settings} from "lucide-react";
import {Brand} from "@/components/brand";
import {Dialog,DialogTrigger} from "@/components/ui/dialog";
import {ModalContent} from "@/components/modal-shell";

export function DirectoryFooter({open,onOpenChange}:{open?:boolean;onOpenChange?:(value:boolean)=>void}={}){const [localInfo,setLocalInfo]=useState(false);const info=open??localInfo,setInfo=onOpenChange??setLocalInfo;return <Dialog open={info} onOpenChange={setInfo}><div className="footer-band"><footer className="footer directory-footer wrap">
 <div className="footer-branding"><Brand/><p className="footer-tagline">Finde die passende Werkstatt in Kosovo.</p></div>
 <nav className="footer-navigation" aria-label="Informationen und Einstellungen">
  <Link className="footer-action footer-settings" href="/einstellungen"><Settings className="footer-action-icon" size={20} aria-hidden="true"/><span>Einstellungen</span><ChevronRight className="footer-action-arrow" size={18} aria-hidden="true"/></Link>
  <DialogTrigger asChild><button className="footer-action" type="button"><FileCheck2 className="footer-action-icon" size={20} aria-hidden="true"/><span>Quellen & Nachweise</span></button></DialogTrigger>
  <Link className="footer-action" href="/datenschutz"><LockKeyhole className="footer-action-icon" size={20} aria-hidden="true"/><span>Datenschutz</span></Link>
 </nav>
 <span className="footer-copyright">© 2026 Riparim</span>
 </footer></div><ModalContent className="info-modal" title="Quellen & Nachweise" description="Was geprüft wird – und was privat bleibt."><section><h3>Betriebsangaben</h3><p>Kontakt, Standort und Leistungen stammen aus den im Profil verlinkten Quellen. Verzeichnisangaben werden als solche gekennzeichnet. Der Quellenabgleich ist keine Qualitätsprüfung.</p></section><section><h3>Bewertungen</h3><p>Bewertung und Besuchsnachweis reichst du gemeinsam ein. Die Unterlagen werden privat und manuell geprüft. Erst nach Freigabe wird die Bewertung veröffentlicht. Die Prüfung ist keine Garantie für künftige Arbeiten.</p></section><section><h3>Direkter Kontakt</h3><p>Arbeit, Kosten und Termin klärst du selbst mit dem Betrieb. Ein Kontaktklick belegt keine Nachricht und keinen Besuch.</p></section><section><h3>Deine Daten</h3><p>Private Belege bleiben zu deinem Konto auf dem Server gespeichert. Unter „Meine Bewertungen“ kannst du die gesamte Einreichung löschen. Fahrzeugmodell, Baujahr, Problem und Reisezeitraum aus der Suche bleiben im Arbeitsspeicher dieses Browserlaufs. Suchfilter stehen in der Such-URL. Beim Öffnen von WhatsApp wird dein vorbereiteter Nachrichtentext an WhatsApp übergeben.</p></section><p className="help">Ortsmittelpunkte: <a href="https://www.geonames.org/" target="_blank" rel="noopener noreferrer">GeoNames</a>.</p></ModalContent></Dialog>;
}
