import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

// These recipes describe shared application surfaces. Component-specific layout
// and state overrides stay with their owning JSX.
export const pageFrameClassName =
  "mx-auto w-[min(var(--page-max-width),calc(100%_-_2_*_var(--page-gutter)))]";

export const contentPageClassName =
  "pt-[var(--content-page-padding-top)] pb-[var(--content-page-padding-bottom)]";
export const contentTitleClassName =
  "m-0 text-[length:var(--content-page-title-size)] font-[var(--content-page-title-weight)] leading-[1.2] tracking-[-0.8px]";

export const appButton = cva(
  "cursor-pointer disabled:cursor-not-allowed disabled:opacity-[0.45] focus-visible:[outline:3px_solid_#288f82] focus-visible:outline-offset-4 dark:focus-visible:outline-ring",
  {
    variants: {
      variant: {
        primary:
          "inline-flex min-h-[46px] items-center justify-center gap-[9px] rounded-[10px] border border-primary bg-primary px-[21px] py-3 text-[14px] font-[650] text-primary-foreground hover:enabled:bg-[#07584e] dark:hover:enabled:border-[#0c685a] dark:hover:enabled:bg-[#0c685a]",
        outline:
          "inline-flex min-h-[46px] items-center justify-center gap-[9px] rounded-[10px] border border-border bg-white px-[21px] py-3 text-[14px] font-[650] text-inherit [outline-style:none] hover:enabled:bg-[#f0f6f5] dark:bg-card dark:text-foreground dark:hover:enabled:border-input dark:hover:enabled:bg-[var(--theme-hover)]",
        text: "mt-2 inline-block border-0 bg-transparent p-0 text-[14px] font-semibold text-[#216f4b] underline underline-offset-[3px] dark:text-[var(--theme-accent)]",
        danger:
          "flex items-center gap-[5px] border-0 bg-transparent p-0 text-[13px] text-[#9a5747] dark:text-[var(--theme-danger)]",
      },
      size: {
        default: "",
        small: "px-[13px] py-2",
      },
    },
    defaultVariants: { variant: "primary", size: "default" },
  },
);

export const eyebrowClassName =
  "flex items-center gap-[9px] text-[13px] font-[750] tracking-[0.06em] text-[#557164] dark:text-[var(--theme-accent)]";
export const helpTextClassName =
  "text-[14px] font-normal leading-[1.6] text-muted-foreground";
export const errorClassName =
  "rounded-[7px] border border-[#f0cbc6] bg-[#fff1ee] px-[14px] py-[11px] text-[14px] text-[#a63c30] dark:border-[#75413e] dark:bg-[#3a2426] dark:text-[var(--theme-danger)]";
export const noteClassName =
  "flex items-start gap-3 rounded-lg bg-[#eef5ef] p-[15px] text-[14px] dark:bg-[var(--theme-surface)] dark:text-muted-foreground [&>svg]:mt-[3px] [&>svg]:text-[#287052] dark:[&>svg]:text-[var(--theme-positive)]";
export const emptyStateClassName =
  "rounded-[10px] border border-dashed border-[#cfddde] bg-white px-6 py-9 text-center dark:border-border dark:bg-card dark:text-foreground [&>svg]:mx-auto [&>svg]:mb-[15px] [&>svg]:text-[#57866c]";
export const emptyStateCopyClassName =
  "mx-auto mt-[10px] mb-5 max-w-[460px] text-[15px] text-muted-foreground";
export const loadingStateClassName =
  "flex min-h-[210px] items-center justify-center gap-[10px] text-[14px] text-muted-foreground at-most-720:min-h-[200px]";

export const formClassName = "flex flex-col gap-4";
export const formLabelClassName =
  "block text-[14px] font-semibold text-[#40594b] dark:text-foreground";
export const formHintClassName =
  "text-[12px] font-normal text-[#829084] dark:text-muted-foreground";
export const inputClassName =
  "mt-[6px] block w-full rounded-[7px] border border-[#d8e1db] bg-white px-3 py-[10px] text-[16px] font-normal text-[#233d2e] outline-offset-2 focus:[outline:2px_solid_#35866a] dark:border-input dark:bg-background dark:text-foreground dark:placeholder:text-[#8da7a7] dark:focus:outline-ring";
export const textareaClassName = cn(inputClassName, "min-h-[90px] resize-y");
export const formGridClassName =
  "grid grid-cols-2 gap-[14px] at-most-720:grid-cols-1";
export const formActionsClassName = "flex justify-end gap-[10px]";

const dialogLayoutClassName =
  "flex min-h-0 max-h-[min(90dvh,920px)] flex-col gap-0 overflow-clip rounded-[16px] p-0 dark:border-border dark:bg-card dark:text-foreground at-most-720:max-h-[calc(100dvh_-_28px)] at-most-720:rounded-[14px]";
export const dialogFrameClassName = cn(
  dialogLayoutClassName,
  "max-w-[min(650px,calc(100%_-_32px))] border-[#dce6e8] bg-white text-[15px] [box-shadow:0_24px_80px_#0f2d3024] dark:[box-shadow:0_24px_80px_#00000040] sm:max-w-[min(650px,calc(100%_-_32px))]",
);
export const confirmationDialogClassName = cn(
  dialogLayoutClassName,
  "bg-white text-[15px]",
);
export const dialogHeaderClassName =
  "shrink-0 items-start gap-[7px] border-b border-[#e0e8ea] bg-white pt-[23px] pr-[60px] pb-[21px] pl-6 text-left dark:border-border dark:bg-card at-most-720:gap-[6px] at-most-720:pt-[19px] at-most-720:pr-[53px] at-most-720:pb-[17px] at-most-720:pl-[18px]";
export const dialogTitleClassName =
  "m-0 text-[24px] font-[650] leading-[1.2] tracking-[-0.5px] text-[#183337] dark:text-foreground at-most-720:text-[21px] at-most-720:tracking-[-0.3px]";
export const dialogDescriptionClassName =
  "m-0 text-[14px] leading-[1.5] text-muted-foreground at-most-720:text-[13px]";
export const dialogCopyClassName =
  "leading-[1.65] text-[#566c71] dark:text-muted-foreground";
export const dialogBodyClassName =
  "flex min-h-0 flex-[1_1_auto] flex-col gap-[18px] overflow-y-auto overscroll-contain px-6 py-[22px] [scrollbar-gutter:stable] outline-offset-[-3px] focus:outline-none focus-visible:[outline:2px_solid_#8cc7b8] focus-visible:outline-offset-[-2px] at-most-720:gap-4 at-most-720:p-[18px]";
export const dialogFooterClassName =
  "m-0 flex shrink-0 flex-row flex-wrap items-center justify-end gap-[10px] border-t border-[#e0e8ea] bg-[#f7fafb] px-6 py-4 dark:border-border dark:bg-[var(--theme-surface)] at-most-720:gap-[9px] at-most-720:px-[18px] at-most-720:py-[13px]";
export const dialogCloseClassName =
  "top-4 right-4 grid size-9 place-items-center rounded-[9px] bg-[#f2f6f7] text-[#4e666b] opacity-100 data-[state=open]:bg-[#f2f6f7] data-[state=open]:text-[#4e666b] hover:bg-[#e5eeee] data-[state=open]:hover:bg-[#e5eeee] focus-visible:outline-[3px] focus-visible:outline-solid focus-visible:outline-[#288f82] focus-visible:outline-offset-4 dark:bg-secondary dark:text-foreground dark:data-[state=open]:bg-secondary dark:data-[state=open]:text-foreground dark:hover:bg-accent dark:data-[state=open]:hover:bg-accent dark:focus-visible:outline-ring at-most-720:top-[13px] at-most-720:right-3 at-most-720:size-[33px]";
export const confirmationActionClassName =
  "h-auto min-h-11 rounded-[10px] bg-[#b43c36] px-[18px] py-[10px] text-[14px] text-white at-most-720:flex-1";
export const confirmationCancelClassName =
  "h-auto min-h-11 rounded-[10px] border border-[#d3dfe1] bg-white px-[18px] py-[10px] text-[14px] dark:border-border dark:bg-secondary dark:text-foreground at-most-720:flex-1";
