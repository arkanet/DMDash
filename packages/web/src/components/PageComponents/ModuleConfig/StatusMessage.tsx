import { useWaitForConfig } from "@app/core/hooks/useWaitForConfig";
import {
  type StatusMessageValidation,
  StatusMessageValidationSchema,
} from "@app/validation/moduleConfig/statusMessage.ts";
import { createZodResolver } from "@components/Form/createZodResolver.ts";
import { type DynamicFormFormInit, useSyncFormValues } from "@components/Form/DynamicForm.tsx";
import { FieldWrapper } from "@components/Form/FormWrapper.tsx";
import { Heading } from "@components/UI/Typography/Heading.tsx";
import { Subtle } from "@components/UI/Typography/Subtle.tsx";
import { useConfigTarget } from "@core/hooks/useConfigTarget.tsx";
import { deepCompareConfig } from "@core/utils/deepCompareConfig.ts";
import { useEffect, useRef } from "react";
import { Controller, FormProvider, type DefaultValues, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

interface StatusMessageModuleConfigProps {
  onFormInit: DynamicFormFormInit<StatusMessageValidation>;
}

export const StatusMessage = ({ onFormInit }: StatusMessageModuleConfigProps) => {
  useWaitForConfig({ moduleConfigCase: "statusmessage" });

  const { moduleConfig, setChange, getEffectiveModuleConfig, removeChange } = useConfigTarget();
  const { t } = useTranslation("moduleConfig");

  const onSubmit = (data: StatusMessageValidation) => {
    if (deepCompareConfig(moduleConfig.statusmessage, data, true)) {
      removeChange({ type: "moduleConfig", variant: "statusmessage" });
      return;
    }

    setChange({ type: "moduleConfig", variant: "statusmessage" }, data, moduleConfig.statusmessage);
  };

  const formMethods = useForm<StatusMessageValidation>({
    mode: "onChange",
    defaultValues: moduleConfig.statusmessage as DefaultValues<StatusMessageValidation>,
    resolver: createZodResolver(StatusMessageValidationSchema),
    shouldFocusError: false,
    resetOptions: { keepDefaultValues: true },
  });

  useSyncFormValues(
    formMethods,
    getEffectiveModuleConfig("statusmessage") as StatusMessageValidation,
  );

  const hasInitializedFormRef = useRef(false);
  const formMethodsRef = useRef(formMethods);

  useEffect(() => {
    if (!hasInitializedFormRef.current) {
      hasInitializedFormRef.current = true;
      onFormInit?.(formMethodsRef.current);
    }
  }, [onFormInit]);

  return (
    <FormProvider {...formMethods}>
      <form className="space-y-8" onChange={formMethods.handleSubmit(onSubmit)}>
        <div className="space-y-8 sm:space-y-5">
          <div>
            <Heading as="h4" className="font-medium">
              {t("statusMessage.title", "Status Message Config")}
            </Heading>
            <Subtle>
              {t(
                "statusMessage.description",
                "The node periodically rebroadcasts this message so nearby nodes can display it in their node list.",
              )}
            </Subtle>
          </div>

          <FieldWrapper
            label={t("statusMessage.nodeStatus.label", "Status message")}
            fieldName="nodeStatus"
            description={t(
              "statusMessage.nodeStatus.description",
              "Set the status text broadcast by this node. Maximum 79 characters.",
            )}
            valid={!formMethods.formState.errors.nodeStatus}
            validationText={formMethods.formState.errors.nodeStatus?.message}
          >
            <Controller
              name="nodeStatus"
              control={formMethods.control}
              render={({ field }) => (
                <textarea
                  id="nodeStatus"
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  value={field.value ?? ""}
                  onChange={(event) => field.onChange(event.target.value.slice(0, 79))}
                  onBlur={field.onBlur}
                  ref={field.ref}
                  rows={4}
                  maxLength={79}
                  placeholder={t("statusMessage.nodeStatus.placeholder", "Set your status...")}
                />
              )}
            />
          </FieldWrapper>
        </div>
      </form>
    </FormProvider>
  );
};
