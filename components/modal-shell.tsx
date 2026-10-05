"use client";
import {useI18n} from "@/lib/i18n/client";
import type {ComponentProps,ReactNode} from "react";
import {DialogContent,DialogHeader,DialogTitle,DialogDescription,DialogFooter,DialogClose} from "@/components/ui/dialog";
import {cn} from "@/lib/utils";

type Props=Omit<ComponentProps<typeof DialogContent>,"title">&{title?:ReactNode;description?:ReactNode;header?:ReactNode;footer?:ReactNode;closeDisabled?:boolean};
export function ModalBody({className,...props}:ComponentProps<"div">){const {t}=useI18n();return <div data-slot="dialog-body" className={cn("modal-body",className)} role="region" aria-label={t("common.dialogContent")} tabIndex={0} {...props}/>;}
export function ModalContent({title,description,header,footer,closeDisabled=false,className,children,...props}:Props){
 const {t}=useI18n();
 return <DialogContent className={cn("modal app-dialog",className)} showCloseButton={!closeDisabled} {...props}><DialogHeader>{header??<><DialogTitle>{title}</DialogTitle>{description&&<DialogDescription>{description}</DialogDescription>}</>}</DialogHeader><ModalBody>{children}</ModalBody><DialogFooter>{footer??<DialogClose asChild><button className="outline" disabled={closeDisabled}>{t("common.close")}</button></DialogClose>}</DialogFooter></DialogContent>;
}
