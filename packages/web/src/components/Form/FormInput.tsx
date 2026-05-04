import type {
  BaseFormBuilderProps,
  GenericFormElementProps,
} from "@components/Form/DynamicForm.tsx";
import { Input } from "@components/UI/Input.tsx";
import type { ChangeEventHandler } from "react";
import { type FieldValues, useController } from "react-hook-form";

export interface InputFieldProps<T> extends BaseFormBuilderProps<T> {
  type: "text" | "number" | "password";
  inputChange?: ChangeEventHandler;
  prefix?: string;
  properties?: {
    id?: string;
    suffix?: string;
    step?: number;
    inputMode?: "none" | "text" | "tel" | "url" | "email" | "numeric" | "decimal" | "search";
    pattern?: string;
    lang?: string;
    normalizeDecimalSeparator?: boolean;
    className?: string;
    fieldLength?: {
      min?: number;
      max?: number;
      currentValueLength?: number;
      showCharacterCount?: boolean;
    };
    showPasswordToggle?: boolean;
    showCopyButton?: boolean;
  };
}

export function GenericInput<T extends FieldValues>({
  control,
  disabled,
  field,
}: GenericFormElementProps<T, InputFieldProps<T>>) {
  const { fieldLength, normalizeDecimalSeparator, ...restProperties } = field.properties || {};

  const {
    field: controllerField,
    fieldState: { error, isDirty },
  } = useController({
    name: field.name,
    control,
    rules: {
      minLength: field.properties?.fieldLength?.min,
      maxLength: field.properties?.fieldLength?.max,
    },
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const normalizedValue = normalizeDecimalSeparator
      ? e.target.value.replaceAll(",", ".")
      : e.target.value;

    if (normalizedValue !== e.target.value) {
      e.target.value = normalizedValue;
      e.currentTarget.value = normalizedValue;
    }

    if (
      field.properties?.fieldLength?.max &&
      normalizedValue.length > field.properties.fieldLength.max
    ) {
      return;
    }

    if (field.inputChange) {
      field.inputChange(e);
    }

    if (field.type === "number") {
      if (normalizedValue === "") {
        controllerField.onChange("");
        return;
      }

      const parsed = Number.parseFloat(normalizedValue);
      controllerField.onChange(Number.isNaN(parsed) ? normalizedValue : parsed.toString());
      return;
    }

    controllerField.onChange(normalizedValue);
  };

  const currentLength = controllerField.value ? String(controllerField.value).length : 0;

  return (
    <div className="relative w-full">
      <Input
        type={field.type}
        step={field.properties?.step}
        value={field.type === "number" ? String(controllerField.value) : controllerField.value}
        id={field.name}
        onChange={handleInputChange}
        showCopyButton={field.properties?.showCopyButton}
        showPasswordToggle={field.properties?.showPasswordToggle || field.type === "password"}
        className={field.properties?.className}
        {...restProperties}
        disabled={disabled}
        variant={error ? "invalid" : isDirty ? "dirty" : "default"}
      />

      {fieldLength?.showCharacterCount && fieldLength.max && (
        <div className="absolute inset-y-0 right-0 flex items-center pr-3 text-sm text-slate-900 dark:text-slate-200">
          {currentLength}/{fieldLength.max}
        </div>
      )}
    </div>
  );
}
