"use client";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/client";
import { valueLabel } from "@/lib/i18n/values";
import { useId } from "react";
import { SearchablePicker } from "@/components/searchable-picker";
import {
  catalogueOptions,
  catalogueValues,
  catalogueChoice,
  type CatalogueChoice,
  type CatalogueFilters,
} from "@/lib/catalogue-filters";
import { services, type Workshop } from "@/lib/workshops";

export function CatalogueFilterFields({
  filters,
  onChange,
  directory,
  fields = ["service", "city", "brand", "language"],
  presentation = "default",
}: {
  filters: CatalogueFilters;
  onChange: (
    field: "service" | "city" | "brand" | "language",
    value: CatalogueChoice,
  ) => void;
  directory: Workshop[];
  presentation?: "default" | "sidebar" | "dialog";
  fields?: readonly ("service" | "city" | "brand" | "language")[];
}) {
  const { locale, t } = useI18n();
  const id = useId(),
    options = catalogueOptions(directory, locale),
    withSelected = (values: string[], selected: CatalogueChoice) => [
      ...new Set([...values, ...catalogueValues(selected)]),
    ];
  return (
    <div
      className={cn(
        "grid grid-cols-[repeat(auto-fit,minmax(min(100%,16rem),1fr))] gap-[15px]",
        presentation === "sidebar" &&
          "grid-cols-[minmax(0,1fr)] gap-5 at-most-1000:hidden",
        presentation === "dialog" && "grid-cols-1",
      )}
      data-ui="catalogue-filter-fields"
      role="group"
      aria-label={t("public.filterLabel")}
    >
      {(
        [
          { key: "service", label: t("public.service"), values: services },
          {
            key: "city",
            label: t("public.city"),
            values: withSelected(options.cities, filters.city),
          },
          {
            key: "brand",
            label: t("public.brand"),
            values: withSelected(options.brands, filters.brand),
          },
          {
            key: "language",
            label: t("public.consultationLanguage"),
            values: withSelected(options.languages, filters.language),
          },
        ] as const
      )
        .filter((field) => fields.includes(field.key))
        .sort((a, b) => fields.indexOf(a.key) - fields.indexOf(b.key))
        .map((field) => (
          <div className="min-w-0" key={field.key}>
            <label
              className="mb-2 block text-[1rem] font-[550] text-[#315249] dark:text-foreground"
              htmlFor={`${id}-${field.key}`}
            >
              {field.label}
            </label>
            <SearchablePicker
              presentation="catalogue"
              multiple={field.key !== "language"}
              allValue={field.values[0]}
              id={`${id}-${field.key}`}
              value={filters[field.key]}
              onChange={(value) =>
                onChange(
                  field.key,
                  catalogueChoice(catalogueValues(value), field.values[0]),
                )
              }
              values={[...field.values]}
              label={field.label}
              displayLabels={Object.fromEntries(
                field.values.map((value) => [
                  value,
                  valueLabel(
                    locale,
                    field.key === "service" ? "service" : "language",
                    valueLabel(locale, "sentinel", value),
                  ),
                ]),
              )}
              disabled={
                field.key === "language" && options.languages.length === 1
              }
            />
            {field.key === "language" && options.languages.length === 1 && (
              <p className="mt-2 text-[0.875rem] leading-[1.55] text-[#617467] dark:text-muted-foreground">
                {t("public.languageUnknown")}
              </p>
            )}
          </div>
        ))}
    </div>
  );
}
