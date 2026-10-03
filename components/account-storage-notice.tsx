import {Cloud} from "lucide-react";
export type AccountIdentity={email:string;displayName:string;provider?:string};
export function AccountStorageNotice(){return <aside className="account-storage-notice storage-notice" aria-label="Private Speicherung"><Cloud size={18}/><p>Nachweise bleiben privat und werden auf dem Server gespeichert.</p></aside>;}
