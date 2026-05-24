import { create, fromBinary } from "@bufbuild/protobuf";
import { Button } from "@components/UI/Button.tsx";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@components/UI/Dialog.tsx";
import { Input } from "@components/UI/Input.tsx";
import { Label } from "@components/UI/Label.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@components/UI/Select.tsx";
import { Switch } from "@components/UI/Switch.tsx";
import { useDevice } from "@core/stores";
import { deepCompareConfig } from "@core/utils/deepCompareConfig.ts";
import { Protobuf } from "@meshtastic/core";
import { toByteArray } from "base64-js";
import { useEffect, useState } from "react";
import { Trans, useTranslation } from "react-i18next";

const MAX_CHANNELS = 8;

export interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loraConfig?: Protobuf.Config.Config_LoRaConfig;
}

function cloneModuleSettings(settings?: Protobuf.Channel.ModuleSettings) {
  return settings ? create(Protobuf.Channel.ModuleSettingsSchema, settings) : undefined;
}

function mergeChannelSettings(settings?: Protobuf.Channel.ChannelSettings) {
  return create(Protobuf.Channel.ChannelSettingsSchema, {
    channelNum: settings?.channelNum ?? 0,
    psk: new Uint8Array(settings?.psk ?? new Uint8Array(0)),
    name: settings?.name ?? "",
    id: settings?.id ?? 0,
    uplinkEnabled: settings?.uplinkEnabled ?? false,
    downlinkEnabled: settings?.downlinkEnabled ?? false,
    moduleSettings: cloneModuleSettings(settings?.moduleSettings),
    mute: settings?.mute ?? false,
  });
}

function createEmptyChannelSettings() {
  return create(Protobuf.Channel.ChannelSettingsSchema);
}

function getChannelRole(index: number, enabledCount: number) {
  if (index === 0) {
    return Protobuf.Channel.Channel_Role.PRIMARY;
  }

  return index < enabledCount
    ? Protobuf.Channel.Channel_Role.SECONDARY
    : Protobuf.Channel.Channel_Role.DISABLED;
}

function getSortedChannels(channels: Iterable<Protobuf.Channel.Channel>) {
  return Array.from(channels).sort((a, b) => a.index - b.index);
}

function getEnabledSettings(channels: Protobuf.Channel.Channel[]) {
  return channels
    .filter((channel) => channel.role !== Protobuf.Channel.Channel_Role.DISABLED)
    .map((channel) => mergeChannelSettings(channel.settings));
}

export const ImportDialog = ({ open, onOpenChange }: ImportDialogProps) => {
  const { setChange, removeChange, channels, config } = useDevice();
  const { t } = useTranslation("dialog");
  const [importDialogInput, setImportDialogInput] = useState<string>("");
  const [channelSet, setChannelSet] = useState<Protobuf.AppOnly.ChannelSet>();
  const [validUrl, setValidUrl] = useState<boolean>(false);
  const [updateConfig, setUpdateConfig] = useState<boolean>(true);
  const [importIndex, setImportIndex] = useState<number[]>([]);

  useEffect(() => {
    // the channel information is contained in the URL's fragment, which will be present after a
    // non-URL encoded `#`.
    try {
      const channelsUrl = new URL(importDialogInput);
      if (
        channelsUrl.hostname !== "meshtastic.org" ||
        channelsUrl.pathname !== "/e/" ||
        !channelsUrl.hash
      ) {
        throw t("import.error.invalidUrl");
      }

      const encodedChannelConfig = channelsUrl.hash.substring(1);
      const paddedString = encodedChannelConfig
        .padEnd(encodedChannelConfig.length + ((4 - (encodedChannelConfig.length % 4)) % 4), "=")
        .replace(/-/g, "+")
        .replace(/_/g, "/");

      const newChannelSet = fromBinary(
        Protobuf.AppOnly.ChannelSetSchema,
        toByteArray(paddedString),
      );

      const newImportChannelArray = newChannelSet.settings.map((_, idx) => idx);

      setChannelSet(newChannelSet);
      setImportIndex(newImportChannelArray);
      setUpdateConfig(newChannelSet?.loraConfig !== undefined);
      setValidUrl(true);
    } catch {
      setValidUrl(false);
      setChannelSet(undefined);
    }
  }, [importDialogInput, t]);

  const stageChannelSettingsList = (nextSettings: Protobuf.Channel.ChannelSettings[]) => {
    const baseChannels = getSortedChannels(channels.values());
    const baseEnabledSettings = getEnabledSettings(baseChannels);
    const maxIndex = Math.max(baseEnabledSettings.length, nextSettings.length) - 1;

    for (let index = 0; index < MAX_CHANNELS; index++) {
      if (index > maxIndex) {
        removeChange({ type: "channel", index });
        continue;
      }

      const settings = nextSettings[index];
      const payload = create(Protobuf.Channel.ChannelSchema, {
        index,
        role: getChannelRole(index, nextSettings.length),
        settings: settings ? mergeChannelSettings(settings) : createEmptyChannelSettings(),
      });
      const original = channels.get(index);

      if (original && deepCompareConfig(original, payload, true)) {
        removeChange({ type: "channel", index });
        continue;
      }

      setChange({ type: "channel", index }, payload, original);
    }
  };

  const apply = () => {
    const importedSettings =
      channelSet?.settings
        .map((settings, index) => ({ settings, slot: importIndex[index] ?? index }))
        .filter(({ slot }) => slot !== -1)
        .sort((a, b) => a.slot - b.slot)
        .map(({ settings }) => mergeChannelSettings(settings)) ?? [];

    stageChannelSettingsList(importedSettings);

    if (channelSet?.loraConfig && updateConfig) {
      const payload = {
        ...config.lora,
        ...channelSet.loraConfig,
      };

      if (!deepCompareConfig(config.lora, payload, true)) {
        setChange({ type: "config", variant: "lora" }, payload, config.lora);
      }
    }
    // Reset state after import
    setImportDialogInput("");
    setChannelSet(undefined);
    setValidUrl(false);
    setImportIndex([]);
    setUpdateConfig(true);

    onOpenChange(false);
  };

  const onSelectChange = (value: string, index: number) => {
    const newImportIndex = [...importIndex];
    newImportIndex[index] = Number.parseInt(value, 10);
    setImportIndex(newImportIndex);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogClose />
        <DialogHeader>
          <DialogTitle>{t("import.title")}</DialogTitle>
          <DialogDescription>
            <Trans i18nKey={"import.description"} components={{ italic: <i />, br: <br /> }} />
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <Label>{t("import.channelSetUrl")}</Label>
          <Input
            value={importDialogInput}
            variant={importDialogInput === "" ? "default" : validUrl ? "dirty" : "invalid"}
            onChange={(e) => {
              setImportDialogInput(e.target.value);
            }}
          />
          {validUrl && (
            <div className="flex flex-col gap-6 mt-2">
              <div className="flex w-full gap-2">
                <div className=" flex items-center">
                  <Switch
                    className="ml-3 mr-4"
                    checked={updateConfig}
                    onCheckedChange={(next) => setUpdateConfig(next)}
                  />
                  <Label className="">
                    {t("import.useLoraConfig")}
                    <span className="block pt-2 font-normal text-s">
                      {t("import.presetDescription")}
                    </span>
                  </Label>
                </div>
              </div>

              <div className="flex w-full flex-col gap-2">
                <div className="flex items-center font-semibold text-sm">
                  <span className="flex-1">{t("import.channelName")}</span>
                  <span className="flex-1">{t("import.channelSlot")}</span>
                </div>
                {channelSet?.settings.map((channel, index) => (
                  <div className="flex items-center" key={`channel_${channel.id}_${index}`}>
                    <Label className="flex-1">
                      {channel.name.length
                        ? channel.name
                        : `${t("import.channelPrefix")}${channel.id}`}
                    </Label>
                    <Select
                      onValueChange={(value) => onSelectChange(value, index)}
                      value={importIndex[index]?.toString()}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 8 }, (_, i) => i).map((i) => (
                          <SelectItem
                            key={`index_${i}`}
                            disabled={importIndex.includes(i) && importIndex[index] !== i}
                            value={i.toString()}
                          >
                            {i === 0 ? t("import.primary") : `${t("import.channelPrefix")}${i}`}
                          </SelectItem>
                        ))}
                        <SelectItem value="-1">{t("import.doNotImport")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button onClick={apply} disabled={!validUrl} name="apply">
            {t("button.apply")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
