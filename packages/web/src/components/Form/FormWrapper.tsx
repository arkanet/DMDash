import { Label } from "@components/UI/Label.tsx";

export interface FieldWrapperProps {
  label: string;
  fieldName: string;
  description?: string;
  disabled?: boolean;
  children?: React.ReactNode;
  valid?: boolean;
  validationText?: string;
}

export const FieldWrapper = ({
  label,
  fieldName,
  description,
  children,
  valid,
  validationText,
}: FieldWrapperProps) => (
  <div className="darkmesh-field-wrapper pt-6 sm:pt-5">
    <fieldset aria-labelledby="label-notifications">
      {/* first column = labels/heading, second column = fields, third column = gutter  */}
      <div className="darkmesh-field-grid grid grid-cols-1 lg:grid-cols-[0.6fr_2fr_.1fr] sm:items-baseline gap-4">
        <Label htmlFor={fieldName} className="darkmesh-field-label">
          {label}
        </Label>
        <div className="darkmesh-field-body max-w-3xl">
          <p className="darkmesh-field-description text-sm text-slate-500 dark:text-slate-400">
            {description}
          </p>
          <p hidden={valid ?? true} className="text-sm text-red-500">
            {validationText}
          </p>
          <div className="darkmesh-field-control mt-4 space-y-4 sm:col-span-2">
            <div className="darkmesh-field-control-inner flex items-center">{children}</div>
          </div>
        </div>
      </div>
    </fieldset>
  </div>
);
