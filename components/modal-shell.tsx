"use client";
import { useI18n } from "@/lib/i18n/client";
import type { ComponentProps, ReactNode } from "react";
import {
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  appButton,
  dialogBodyClassName,
  dialogCloseClassName,
  dialogDescriptionClassName,
  dialogFooterClassName,
  dialogFrameClassName,
  dialogHeaderClassName,
  dialogTitleClassName,
} from "@/lib/presentation";

type Props = Omit<ComponentProps<typeof DialogContent>, "title"> & {
  title?: ReactNode;
  description?: ReactNode;
  header?: ReactNode;
  footer?: ReactNode;
  closeDisabled?: boolean;
};
export function ModalBody({ className, ...props }: ComponentProps<"div">) {
  const { t } = useI18n();
  return (
    <div
      data-slot="dialog-body"
      className={cn(dialogBodyClassName, className)}
      role="region"
      aria-label={t("common.dialogContent")}
      tabIndex={0}
      {...props}
    />
  );
}
export function ModalContent({
  title,
  description,
  header,
  footer,
  closeDisabled = false,
  className,
  children,
  ...props
}: Props) {
  const { t } = useI18n();
  return (
    <DialogContent
      className={cn(dialogFrameClassName, className)}
      closeButtonClassName={dialogCloseClassName}
      showCloseButton={!closeDisabled}
      {...props}
    >
      <DialogHeader className={dialogHeaderClassName}>
        {header ?? (
          <>
            <DialogTitle className={dialogTitleClassName}>{title}</DialogTitle>
            {description && (
              <DialogDescription className={dialogDescriptionClassName}>
                {description}
              </DialogDescription>
            )}
          </>
        )}
      </DialogHeader>
      <ModalBody>{children}</ModalBody>
      <DialogFooter className={dialogFooterClassName}>
        {footer ?? (
          <DialogClose asChild>
            <button
              className={cn(
                appButton({ variant: "outline" }),
                "[@media(max-width:720px)]:min-h-[45px] [@media(max-width:720px)]:px-[13px] [@media(max-width:720px)]:text-[13px]",
              )}
              disabled={closeDisabled}
            >
              {t("common.close")}
            </button>
          </DialogClose>
        )}
      </DialogFooter>
    </DialogContent>
  );
}
