import { createUserValidationSchema, type UserValidation } from "@app/validation/config/user.ts";
import { create } from "@bufbuild/protobuf";
import { DynamicForm, type DynamicFormFormInit } from "@components/Form/DynamicForm.tsx";
import { useConfigTarget } from "@core/hooks/useConfigTarget.tsx";
import { useNodeDB } from "@core/stores";
import { deepCompareConfig } from "@core/utils/deepCompareConfig.ts";
import { Protobuf } from "@meshtastic/core";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

interface UserConfigProps {
  onFormInit: DynamicFormFormInit<UserValidation>;
}

export const User = ({ onFormInit }: UserConfigProps) => {
  const { targetNodeNum, getChange, setChange, removeChange } = useConfigTarget();
  const { getNode } = useNodeDB();
  const { t } = useTranslation("config");
  const validationSchema = useMemo(() => createUserValidationSchema(t), [t]);

  const defaultUser = getNode(targetNodeNum)?.user ?? {
    id: "",
    longName: "",
    shortName: "",
    hwModel: Protobuf.Mesh.HardwareModel.UNSET,
    isLicensed: false,
    isUnmessagable: false,
  };

  const workingUser = getChange({ type: "user" }) as Protobuf.Mesh.User | undefined;
  const effectiveUser = workingUser ?? defaultUser;
  const defaultHardwareModel = (
    Protobuf.Mesh.HardwareModel[defaultUser.hwModel ?? 0] ?? t("unknown.notAvailable", "N/A")
  ).replace(/_/g, " ");
  const effectiveHardwareModel = (
    Protobuf.Mesh.HardwareModel[effectiveUser.hwModel ?? 0] ?? t("unknown.notAvailable", "N/A")
  ).replace(/_/g, " ");

  const onSubmit = (data: UserValidation) => {
    const payload = create(Protobuf.Mesh.UserSchema, {
      id: defaultUser.id,
      longName: data.longName,
      shortName: data.shortName,
      isLicensed: data.isLicensed,
      isUnmessagable: data.isUnmessageable,
    });

    if (deepCompareConfig(defaultUser, payload, true)) {
      removeChange({ type: "user" });
      return;
    }

    setChange({ type: "user" }, payload, defaultUser);
  };

  return (
    <DynamicForm<UserValidation>
      onSubmit={onSubmit}
      onFormInit={onFormInit}
      validationSchema={validationSchema}
      defaultValues={{
        nodeId: defaultUser.id,
        longName: defaultUser.longName,
        shortName: defaultUser.shortName,
        hardwareModel: defaultHardwareModel,
        isLicensed: defaultUser.isLicensed ?? false,
        isUnmessageable: defaultUser.isUnmessagable ?? false,
      }}
      values={{
        nodeId: effectiveUser.id,
        longName: effectiveUser.longName,
        shortName: effectiveUser.shortName,
        hardwareModel: effectiveHardwareModel,
        isLicensed: effectiveUser.isLicensed ?? false,
        isUnmessageable: effectiveUser.isUnmessagable ?? false,
      }}
      fieldGroups={[
        {
          label: t("user.title"),
          description: t("user.description"),
          fields: [
            {
              type: "text",
              name: "nodeId",
              label: t("user.nodeId.label", "Node ID"),
              description: t("user.nodeId.description", "The unique identifier of this node."),
              disabled: true,
            },
            {
              type: "text",
              name: "longName",
              label: t("user.longName.label"),
              description: t("user.longName.description"),
              properties: {
                fieldLength: {
                  min: 1,
                  max: 40,
                  showCharacterCount: true,
                },
              },
            },
            {
              type: "text",
              name: "shortName",
              label: t("user.shortName.label"),
              description: t("user.shortName.description"),
              properties: {
                fieldLength: {
                  min: 2,
                  max: 4,
                  showCharacterCount: true,
                },
              },
            },
            {
              type: "text",
              name: "hardwareModel",
              label: t("user.hardwareModel.label", "Hardware model"),
              description: t(
                "user.hardwareModel.description",
                "The hardware model reported by the node firmware.",
              ),
              disabled: true,
            },
            {
              type: "toggle",
              name: "isUnmessageable",
              label: t("user.isUnmessageable.label"),
              description: t("user.isUnmessageable.description"),
            },
            {
              type: "toggle",
              name: "isLicensed",
              label: t("user.isLicensed.label"),
              description: t("user.isLicensed.description"),
            },
          ],
        },
      ]}
    />
  );
};
