import type {Metadata} from "next";
import {createTranslator,getMessages} from "./messages";
import type {Locale} from "./locale";

export function managementMessages(locale:Locale,withFooter=false){return getMessages(locale,withFooter?["management","customer","public"]:["management","customer"]);}
export function managementMetadata(locale:Locale,page:"business"|"workshops"|"users"|"claims"|"reviews"|"login"):Metadata{
 const t=createTranslator(getMessages(locale,["management"]));
 const title={business:t("management.myBusiness"),workshops:t("management.workshopAdministration"),users:t("management.manageUsers"),claims:t("management.businessModeration"),reviews:t("management.moderateReviews"),login:t("management.authSetupTitle")}[page];
 return {title:`${title} · Riparim`,robots:{index:false,follow:false},alternates:null};
}
