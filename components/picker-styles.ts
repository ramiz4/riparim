import { cva, type VariantProps } from "class-variance-authority";

export const pickerVariants = cva(
  "h-auto w-full min-h-9 border-0 bg-transparent p-0 text-[15px] font-[550] whitespace-normal shadow-none focus-visible:outline-[3px] focus-visible:outline-solid focus-visible:outline-[#288f82] focus-visible:outline-offset-4 focus-visible:ring-0 dark:focus-visible:outline-ring disabled:opacity-[0.45] dark:bg-transparent dark:hover:bg-transparent data-[placeholder]:text-inherit data-[size=default]:h-auto data-[size=sm]:h-auto",
  {
    variants: {
      presentation: {
        plain: "at-most-720:text-[16px]",
        form: "focus-visible:border-input min-h-[46px] rounded-lg border border-input bg-background px-3 py-[10px] text-[16px] text-foreground data-[placeholder]:text-foreground dark:bg-background dark:hover:bg-background",
        search: "min-h-[35px] text-[16px]",
        catalogue:
          "focus-visible:border-border dark:focus-visible:border-input min-h-12 rounded-lg border border-border bg-white px-[10px] py-[9px] text-[16px] leading-[1.5] text-[#284c40] dark:border-input dark:bg-card dark:text-foreground dark:hover:bg-card",
        sort: "focus-visible:border-[#c8d8d2] dark:focus-visible:border-input gap-[10px] overflow-visible [&>[data-slot=select-value]]:block [&>[data-slot=select-value]]:overflow-visible [&>[data-slot=select-value]]:text-clip [&>[data-slot=select-value]]:whitespace-normal [&>[data-slot=select-value]]:[overflow-wrap:anywhere] [&>[data-slot=select-value]]:[-webkit-line-clamp:unset] [&>[data-slot=select-value]]:leading-[1.5] at-most-1000:min-w-0 at-most-1000:max-w-none at-most-1000:gap-[6px] at-most-1000:px-2 at-most-1000:py-[6px] at-most-1000:leading-[1.35] at-most-1000:[&>[data-slot=select-value]]:leading-[1.35] min-h-11 min-w-[14rem] max-w-[20rem] rounded-lg border border-[#c8d8d2] bg-white px-[13px] py-[9px] text-[16px] leading-[1.5] text-[#284c40] dark:border-input dark:bg-card dark:text-foreground dark:hover:bg-card",
      },
    },
    defaultVariants: { presentation: "plain" },
  },
);
export type PickerPresentation = NonNullable<
  VariantProps<typeof pickerVariants>["presentation"]
>;
