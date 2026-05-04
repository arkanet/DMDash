import { useWaitForConfig } from "@app/core/hooks/useWaitForConfig";
import {
  type RemoteHardwareValidation,
  RemoteHardwareValidationSchema,
} from "@app/validation/moduleConfig/remoteHardware.ts";
import { createZodResolver } from "@components/Form/createZodResolver.ts";
import { type DynamicFormFormInit, useSyncFormValues } from "@components/Form/DynamicForm.tsx";
import { FieldWrapper } from "@components/Form/FormWrapper.tsx";
import { Button } from "@components/UI/Button.tsx";
import { Input } from "@components/UI/Input.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@components/UI/Select.tsx";
import { Switch } from "@components/UI/Switch.tsx";
import { Heading } from "@components/UI/Typography/Heading.tsx";
import { Subtle } from "@components/UI/Typography/Subtle.tsx";
import { useConfigTarget } from "@core/hooks/useConfigTarget.tsx";
import { deepCompareConfig } from "@core/utils/deepCompareConfig.ts";
import { cn } from "@core/utils/cn.ts";
import { Protobuf } from "@meshtastic/core";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { useEffect, useRef } from "react";
import {
  Controller,
  FormProvider,
  type DefaultValues,
  type FieldErrors,
  useFieldArray,
  useForm,
} from "react-hook-form";
import { useTranslation } from "react-i18next";

interface RemoteHardwareModuleConfigProps {
  onFormInit: DynamicFormFormInit<RemoteHardwareValidation>;
}

const PIN_TYPE_OPTIONS = Object.entries(Protobuf.ModuleConfig.RemoteHardwarePinType).filter(
  ([, value]) => typeof value === "number",
) as Array<[string, number]>;

const formatPinTypeLabel = (name: string) =>
  name
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());

const getPinFieldError = (
  errors: FieldErrors<RemoteHardwareValidation>,
  index: number,
  key: "gpioPin" | "name" | "type",
) => errors.availablePins?.[index]?.[key]?.message;

export const RemoteHardware = ({ onFormInit }: RemoteHardwareModuleConfigProps) => {
  useWaitForConfig({ moduleConfigCase: "remoteHardware" });

  const { moduleConfig, setChange, getEffectiveModuleConfig, removeChange } = useConfigTarget();
  const { t } = useTranslation("moduleConfig");

  const onSubmit = (data: RemoteHardwareValidation) => {
    if (deepCompareConfig(moduleConfig.remoteHardware, data, true)) {
      removeChange({ type: "moduleConfig", variant: "remoteHardware" });
      return;
    }

    setChange(
      { type: "moduleConfig", variant: "remoteHardware" },
      data,
      moduleConfig.remoteHardware,
    );
  };

  const formMethods = useForm<RemoteHardwareValidation>({
    mode: "onChange",
    defaultValues: moduleConfig.remoteHardware as DefaultValues<RemoteHardwareValidation>,
    resolver: createZodResolver(RemoteHardwareValidationSchema),
    shouldFocusError: false,
    resetOptions: { keepDefaultValues: true },
  });

  useSyncFormValues(
    formMethods,
    getEffectiveModuleConfig("remoteHardware") as RemoteHardwareValidation,
  );

  const hasInitializedFormRef = useRef(false);
  const formMethodsRef = useRef(formMethods);

  useEffect(() => {
    if (!hasInitializedFormRef.current) {
      hasInitializedFormRef.current = true;
      onFormInit?.(formMethodsRef.current);
    }
  }, [onFormInit]);

  const { control, handleSubmit, formState, trigger } = formMethods;
  const { fields, append, remove } = useFieldArray({
    control,
    name: "availablePins",
  });

  const submitCurrentValues = () => {
    handleSubmit(onSubmit)();
  };

  const addPin = async () => {
    append({
      gpioPin: 0,
      name: "",
      type: Protobuf.ModuleConfig.RemoteHardwarePinType.DIGITAL_READ,
    });
    await trigger("availablePins");
    submitCurrentValues();
  };

  const removePin = async (index: number) => {
    remove(index);
    await trigger("availablePins");
    submitCurrentValues();
  };

  return (
    <FormProvider {...formMethods}>
      <form className="space-y-8" onChange={handleSubmit(onSubmit)}>
        <div className="space-y-8 sm:space-y-5">
          <div>
            <Heading as="h4" className="font-medium">
              {t("remoteHardware.title", "Remote Hardware Config")}
            </Heading>
            <Subtle>
              {t(
                "remoteHardware.description",
                "Configure remote GPIO access and the pins exposed to the mesh.",
              )}
            </Subtle>
          </div>

          <FieldWrapper
            label={t("remoteHardware.enabled.label", "Remote Hardware enabled")}
            fieldName="enabled"
            description={t(
              "remoteHardware.enabled.description",
              "Enable the Remote Hardware module.",
            )}
            valid={!formState.errors.enabled}
            validationText={formState.errors.enabled?.message}
          >
            <Controller
              name="enabled"
              control={control}
              render={({ field }) => (
                <Switch
                  id="enabled"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  ref={field.ref}
                />
              )}
            />
          </FieldWrapper>

          <FieldWrapper
            label={t("remoteHardware.allowUndefinedPinAccess.label", "Allow undefined pin access")}
            fieldName="allowUndefinedPinAccess"
            description={t(
              "remoteHardware.allowUndefinedPinAccess.description",
              "Allow consumers to access pins that are not explicitly listed below.",
            )}
            valid={!formState.errors.allowUndefinedPinAccess}
            validationText={formState.errors.allowUndefinedPinAccess?.message}
          >
            <Controller
              name="allowUndefinedPinAccess"
              control={control}
              render={({ field }) => (
                <Switch
                  id="allowUndefinedPinAccess"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  ref={field.ref}
                />
              )}
            />
          </FieldWrapper>

          <FieldWrapper
            label={t("remoteHardware.availablePins.label", "Available pins")}
            fieldName="availablePins"
            description={t(
              "remoteHardware.availablePins.description",
              "Expose up to four pins for remote mesh access.",
            )}
            valid={!formState.errors.availablePins}
            validationText={formState.errors.availablePins?.message}
          >
            <div className="w-full space-y-4">
              {fields.length === 0 ? (
                <div className="rounded-md border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  {t("remoteHardware.availablePins.empty", "No pins configured.")}
                </div>
              ) : null}

              {fields.map((field, index) => {
                const gpioPinError = getPinFieldError(formState.errors, index, "gpioPin");
                const nameError = getPinFieldError(formState.errors, index, "name");
                const typeError = getPinFieldError(formState.errors, index, "type");

                return (
                  <div
                    key={field.id}
                    className="rounded-md border border-slate-300 p-4 dark:border-slate-700"
                  >
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <Heading as="h5" className="text-base font-medium">
                        {t("remoteHardware.availablePins.pinLabel", "Pin {{index}}", {
                          index: index + 1,
                        })}
                      </Heading>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          void removePin(index);
                        }}
                        aria-label={t("remoteHardware.availablePins.remove", "Remove pin")}
                        icon={<Trash2Icon size={16} />}
                      >
                        {t("button.remove", "Remove")}
                      </Button>
                    </div>

                    <div className="grid gap-3 md:grid-cols-[120px_1fr_180px]">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                          {t("remoteHardware.availablePins.gpioPin", "GPIO pin")}
                        </label>
                        <Controller
                          name={`availablePins.${index}.gpioPin`}
                          control={control}
                          render={({ field: controllerField }) => (
                            <Input
                              type="number"
                              value={controllerField.value}
                              onChange={(event) =>
                                controllerField.onChange(
                                  event.target.value === "" ? "" : Number(event.target.value),
                                )
                              }
                              onBlur={controllerField.onBlur}
                              ref={controllerField.ref}
                              variant={gpioPinError ? "invalid" : "default"}
                            />
                          )}
                        />
                        {gpioPinError ? (
                          <p className="text-sm text-red-500">{String(gpioPinError)}</p>
                        ) : null}
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                          {t("remoteHardware.availablePins.name", "Name")}
                        </label>
                        <Controller
                          name={`availablePins.${index}.name`}
                          control={control}
                          render={({ field: controllerField }) => (
                            <Input
                              type="text"
                              value={controllerField.value}
                              onChange={controllerField.onChange}
                              onBlur={controllerField.onBlur}
                              ref={controllerField.ref}
                              variant={nameError ? "invalid" : "default"}
                              placeholder={t(
                                "remoteHardware.availablePins.namePlaceholder",
                                "Front gate",
                              )}
                            />
                          )}
                        />
                        {nameError ? (
                          <p className="text-sm text-red-500">{String(nameError)}</p>
                        ) : null}
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                          {t("remoteHardware.availablePins.type", "Access type")}
                        </label>
                        <Controller
                          name={`availablePins.${index}.type`}
                          control={control}
                          render={({ field: controllerField }) => (
                            <Select
                              value={String(controllerField.value)}
                              onValueChange={(value) => controllerField.onChange(Number(value))}
                            >
                              <SelectTrigger
                                className={cn(typeError ? "border-red-500 focus:ring-red-500" : "")}
                              >
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {PIN_TYPE_OPTIONS.map(([name, value]) => (
                                  <SelectItem key={name} value={String(value)}>
                                    {formatPinTypeLabel(name)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        />
                        {typeError ? (
                          <p className="text-sm text-red-500">{String(typeError)}</p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}

              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  void addPin();
                }}
                disabled={fields.length >= 4}
                icon={<PlusIcon size={16} />}
              >
                {t("remoteHardware.availablePins.add", "Add pin")}
              </Button>
            </div>
          </FieldWrapper>
        </div>
      </form>
    </FormProvider>
  );
};
