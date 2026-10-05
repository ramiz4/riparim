import type {Locale} from "./locale";
export const deletePhrases={de:"KONTO LÖSCHEN",en:"DELETE ACCOUNT",sq:"FSHI LLOGARINË"} as const;
export type DeletePhrase=(typeof deletePhrases)[Locale];
export const canonicalDeleteConfirmation=deletePhrases.de;
export function deleteConfirmation(locale:Locale,value:string){return value===deletePhrases[locale]?canonicalDeleteConfirmation:null;}
