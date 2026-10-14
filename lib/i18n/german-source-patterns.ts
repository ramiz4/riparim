import { storedServices } from "./canonical-values";
// Match original German catalogue content without changing its wording or grouping.
export const directoryDetailSuffix = /\s+laut öffentlichem Verzeichnis\.?/gi;
export const scopeDetailSuffix = /\s*Konkreten Umfang direkt klären\.?/gi;
export const germanServicePatterns: Record<string, RegExp> = {
  [storedServices.maintenance]:
    /wartung|inspektion|öl|filter|batterie|regelmäßig|fahrzeugkontroll/i,
  [storedServices.diagnostics]:
    /diagnos|elektr|kodier|programmier|software|chip/i,
  [storedServices.brakes]:
    /brems|fahrwerk|achs|radgeometr|vermess|lenk|stoßdämp|feder/i,
  [storedServices.engine]: /motor|getriebe|kuppl|antrieb|automat/i,
  [storedServices.bodywork]: /karos|lack|unfall|delle|blech|polier|detailing/i,
  [storedServices.tires]: /reifen|klima|auswucht|wucht|montage|felg|räder/i,
};
