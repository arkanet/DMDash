import { create, fromBinary, toBinary } from "@bufbuild/protobuf";
import { createNodeInfoFromSharedContact, parseSharedContactUrl } from "@app/darkmesh/utils.ts";
import { Channel } from "@app/components/PageComponents/Channels/Channel";
import { Button } from "@components/UI/Button.tsx";
import { Checkbox } from "@components/UI/Checkbox/index.tsx";
import { Dialog, DialogContent, DialogTitle } from "@components/UI/Dialog.tsx";
import { Input } from "@components/UI/Input.tsx";
import { Label } from "@components/UI/Label.tsx";
import { Spinner } from "@components/UI/Spinner.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@components/UI/Tabs.tsx";
import { useConfigTarget } from "@core/hooks/useConfigTarget.tsx";
import { useToast } from "@core/hooks/useToast.ts";
import { useDevice, useNodeDB } from "@core/stores";
import { deepCompareConfig } from "@core/utils/deepCompareConfig.ts";
import {
  isExpectedRebootDisconnectError,
  markExpectedDeviceReconnect,
} from "@core/utils/rebootReconnect.ts";
import { Protobuf } from "@meshtastic/core";
import { fromByteArray, toByteArray } from "base64-js";
import i18next from "i18next";
import {
  ArrowLeftIcon,
  CopyIcon,
  PlusIcon,
  QrCodeIcon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react";
import { Suspense, useEffect, useMemo, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { QRCode } from "react-qrcode-logo";

interface ConfigProps {
  onFormInit: <T extends object>(methods: UseFormReturn<T>) => void;
  standalone?: boolean;
}

const MAX_CHANNELS = 8;

function cloneModuleSettings(settings?: Protobuf.Channel.ModuleSettings) {
  return settings ? create(Protobuf.Channel.ModuleSettingsSchema, settings) : undefined;
}

function mergeChannelSettings(
  settings?: Protobuf.Channel.ChannelSettings,
  patch: Partial<Protobuf.Channel.ChannelSettings> = {},
) {
  return create(Protobuf.Channel.ChannelSettingsSchema, {
    channelNum: patch.channelNum ?? settings?.channelNum ?? 0,
    psk: new Uint8Array(patch.psk ?? settings?.psk ?? new Uint8Array(0)),
    name: patch.name ?? settings?.name ?? "",
    id: patch.id ?? settings?.id ?? 0,
    uplinkEnabled: patch.uplinkEnabled ?? settings?.uplinkEnabled ?? false,
    downlinkEnabled: patch.downlinkEnabled ?? settings?.downlinkEnabled ?? false,
    moduleSettings: cloneModuleSettings(patch.moduleSettings ?? settings?.moduleSettings),
    mute: patch.mute ?? settings?.mute ?? false,
  });
}

function cloneChannelSettings(settings?: Protobuf.Channel.ChannelSettings) {
  return mergeChannelSettings(settings);
}

function createEmptyChannelSettings() {
  return create(Protobuf.Channel.ChannelSettingsSchema);
}

function createDefaultChannelSettings() {
  return mergeChannelSettings(createEmptyChannelSettings(), {
    psk: new Uint8Array([1]),
  });
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
    .map((channel) => cloneChannelSettings(channel.settings));
}

export const getChannelName = (channel: Protobuf.Channel.Channel) => {
  return channel.settings?.name.length
    ? channel.settings?.name
    : channel.index === 0
      ? i18next.t("page.broadcastLabel")
      : i18next.t("page.channelIndex", {
          ns: "channels",
          index: channel.index,
        });
};

export const Channels = ({ onFormInit, standalone = false }: ConfigProps) => {
  const {
    channels,
    config,
    connection,
    connectionId,
    setConfig,
    hasChannelChange,
    getChange,
    setChange,
    removeChange,
    getAllConfigChanges,
    getAllChannelChanges,
    getConfigChangeCount,
    getChannelChangeCount,
    addChannel,
    setDialogOpen,
    isRemote,
  } = useConfigTarget();
  const { sendAdminMessage } = useDevice();
  const { addNode } = useNodeDB();
  const { toast } = useToast();
  const { t } = useTranslation("channels");
  const [isSavingChannels, setIsSavingChannels] = useState(false);
  const [selectedChannels, setSelectedChannels] = useState<number[]>([0]);
  const [qrCodeAdd, setQrCodeAdd] = useState(false);
  const [contactUrl, setContactUrl] = useState("");
  const [channelImportUrl, setChannelImportUrl] = useState("");
  const [validContactUrl, setValidContactUrl] = useState(false);
  const [validChannelUrl, setValidChannelUrl] = useState(false);
  const [editingChannels, setEditingChannels] = useState(false);
  const [mobileEditChannelIndex, setMobileEditChannelIndex] = useState<number | undefined>();
  const [selectedChannelIndex, setSelectedChannelIndex] = useState(0);

  const allChannels = getSortedChannels(channels.values());
  const channelChanges = getAllChannelChanges();
  const getEffectiveChannel = (channel: Protobuf.Channel.Channel) =>
    (getChange({
      type: "channel",
      index: channel.index,
    }) as Protobuf.Channel.Channel | undefined) ?? channel;

  const effectiveChannelMap = new Map<number, Protobuf.Channel.Channel>(
    allChannels.map((channel) => [channel.index, getEffectiveChannel(channel)]),
  );
  channelChanges.forEach((channel) => {
    effectiveChannelMap.set(channel.index, channel);
  });
  const effectiveChannels = getSortedChannels(effectiveChannelMap.values());
  const visibleChannels = effectiveChannels.filter(
    (channel) => channel.role !== Protobuf.Channel.Channel_Role.DISABLED,
  );
  const channelChangeCount = getChannelChangeCount();
  const configChangeCount = getConfigChangeCount();
  const hasStandaloneChanges = channelChangeCount > 0 || configChangeCount > 0;
  const selectedDesktopChannel =
    visibleChannels.find((channel) => channel.index === selectedChannelIndex) ?? visibleChannels[0];
  const flags = useMemo(
    () =>
      new Map(effectiveChannels.map((channel) => [channel.index, hasChannelChange(channel.index)])),
    [effectiveChannels, hasChannelChange],
  );
  const qrCodeUrl = useMemo(() => {
    const channelsToEncode = effectiveChannels
      .filter((channel) => selectedChannels.includes(channel.index))
      .map((channel) => channel.settings)
      .filter((channel): channel is Protobuf.Channel.ChannelSettings => !!channel);
    const encoded = create(
      Protobuf.AppOnly.ChannelSetSchema,
      create(Protobuf.AppOnly.ChannelSetSchema, {
        loraConfig: config.lora,
        settings: channelsToEncode,
      }),
    );
    const base64 = fromByteArray(toBinary(Protobuf.AppOnly.ChannelSetSchema, encoded))
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");

    return `https://meshtastic.org/e/${qrCodeAdd ? "?add=true" : ""}#${base64}`;
  }, [effectiveChannels, config.lora, qrCodeAdd, selectedChannels]);

  const resetStandaloneChanges = () => {
    for (let index = 0; index < MAX_CHANNELS; index++) {
      removeChange({ type: "channel", index });
    }
    removeChange({ type: "config", variant: "lora" });
    setEditingChannels(false);
    setSelectedChannelIndex(0);
  };

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
        settings: settings ? cloneChannelSettings(settings) : createEmptyChannelSettings(),
      });
      const original = channels.get(index);

      if (original && deepCompareConfig(original, payload, true)) {
        removeChange({ type: "channel", index });
        continue;
      }

      setChange({ type: "channel", index }, payload, original);
    }
  };

  const saveStandaloneChanges = async (successTitle = "Canali salvati") => {
    const channelChanges = getAllChannelChanges();
    const configChanges = getAllConfigChanges();
    if (!standalone || (channelChanges.length === 0 && configChanges.length === 0)) {
      return;
    }

    if (!connection) {
      toast({ title: "Radio non connessa", description: "Connetti un device prima di salvare." });
      return;
    }

    setIsSavingChannels(true);
    try {
      await Promise.all(channelChanges.map((channel) => connection.setChannel(channel)));
      await Promise.all(configChanges.map((newConfig) => connection.setConfig(newConfig)));

      if (configChanges.length > 0) {
        const shouldCommitInBackground = !isRemote && Boolean(connectionId);

        if (!isRemote && connectionId) {
          markExpectedDeviceReconnect(connectionId);
        }

        const commitPromise = connection.commitEditSettings();
        if (shouldCommitInBackground) {
          void commitPromise.catch((error) => {
            if (!isExpectedRebootDisconnectError(error)) {
              console.warn("commitEditSettings failed after scheduling reconnect", error);
            }
          });
        } else {
          await commitPromise;
        }
      }

      channelChanges.forEach((channel) => {
        addChannel(channel);
        removeChange({ type: "channel", index: channel.index });
      });
      configChanges.forEach((newConfig) => {
        setConfig(newConfig);
        switch (newConfig.payloadVariant.case) {
          case "device":
          case "position":
          case "power":
          case "network":
          case "display":
          case "lora":
          case "bluetooth":
          case "security":
            removeChange({ type: "config", variant: newConfig.payloadVariant.case });
            break;
        }
      });
      toast({ title: successTitle });
      setEditingChannels(false);
    } catch (error) {
      toast({
        title: "Errore salvataggio",
        description:
          error instanceof Error ? error.message : "Impossibile salvare le modifiche canali.",
      });
    } finally {
      setIsSavingChannels(false);
    }
  };

  useEffect(() => {
    if (
      visibleChannels.length > 0 &&
      !visibleChannels.some((channel) => channel.index === selectedChannelIndex)
    ) {
      setSelectedChannelIndex(visibleChannels[0]?.index ?? 0);
    }
  }, [selectedChannelIndex, visibleChannels]);

  useEffect(() => {
    try {
      parseSharedContactUrl(contactUrl);
      setValidContactUrl(true);
    } catch {
      setValidContactUrl(false);
    }
  }, [contactUrl]);

  useEffect(() => {
    try {
      const channelsUrl = new URL(channelImportUrl);
      if (
        channelsUrl.hostname !== "meshtastic.org" ||
        channelsUrl.pathname !== "/e/" ||
        !channelsUrl.hash
      ) {
        throw new Error("Invalid channel URL");
      }
      setValidChannelUrl(true);
    } catch {
      setValidChannelUrl(false);
    }
  }, [channelImportUrl]);

  const importContact = () => {
    try {
      const contact = parseSharedContactUrl(contactUrl);
      sendAdminMessage(
        create(Protobuf.Admin.AdminMessageSchema, {
          payloadVariant: { case: "addContact", value: contact },
        }),
      );
      addNode(createNodeInfoFromSharedContact(contact, false));
      setContactUrl("");
      toast({ title: "Contact imported" });
    } catch {
      toast({ title: "Invalid contact URL" });
    }
  };

  const importChannels = () => {
    try {
      const channelsUrl = new URL(channelImportUrl);
      const encodedChannelConfig = channelsUrl.hash.substring(1);
      const paddedString = encodedChannelConfig
        .padEnd(encodedChannelConfig.length + ((4 - (encodedChannelConfig.length % 4)) % 4), "=")
        .replace(/-/g, "+")
        .replace(/_/g, "/");

      const channelSet = fromBinary(Protobuf.AppOnly.ChannelSetSchema, toByteArray(paddedString));

      stageChannelSettingsList(channelSet.settings.map(cloneChannelSettings));

      if (channelSet.loraConfig) {
        const payload = {
          ...config.lora,
          ...channelSet.loraConfig,
        };
        if (!deepCompareConfig(config.lora, payload, true)) {
          setChange({ type: "config", variant: "lora" }, payload, config.lora);
        }
      }

      setChannelImportUrl("");
      if (standalone) {
        void saveStandaloneChanges("Importazione salvata");
        return;
      }

      toast({ title: "Channels imported" });
    } catch {
      toast({ title: "Invalid channel URL" });
    }
  };

  const updateMobileChannelSettings = (
    channel: Protobuf.Channel.Channel,
    patch: Partial<Protobuf.Channel.ChannelSettings>,
  ) => {
    const activeSettings = getEnabledSettings(effectiveChannels);
    const currentSettings = activeSettings[channel.index] ?? createEmptyChannelSettings();
    activeSettings[channel.index] = mergeChannelSettings(currentSettings, patch);
    stageChannelSettingsList(activeSettings);
  };

  const addChannelDraft = (openMobileEditor = false) => {
    const activeSettings = getEnabledSettings(effectiveChannels);
    if (activeSettings.length >= MAX_CHANNELS) {
      toast({ title: "Limite canali raggiunto" });
      return;
    }

    const nextIndex = activeSettings.length;
    activeSettings.push(createDefaultChannelSettings());
    stageChannelSettingsList(activeSettings);
    setSelectedChannelIndex(nextIndex);
    setSelectedChannels((current) => Array.from(new Set([...current, nextIndex])));

    if (openMobileEditor) {
      setEditingChannels(true);
      setMobileEditChannelIndex(nextIndex);
    }
  };

  const deleteChannelDraft = (channel: Protobuf.Channel.Channel) => {
    if (channel.index === 0) {
      toast({ title: "Il canale primario non puo essere eliminato" });
      return;
    }
    const activeSettings = getEnabledSettings(effectiveChannels);
    const nextSelectedIndex =
      channel.index >= activeSettings.length - 1 ? Math.max(0, channel.index - 1) : channel.index;
    activeSettings.splice(channel.index, 1);
    stageChannelSettingsList(activeSettings);
    setSelectedChannelIndex((current) => {
      if (current === channel.index) {
        return nextSelectedIndex;
      }

      return current > channel.index ? current - 1 : current;
    });
    setSelectedChannels((current) =>
      current
        .filter((index) => index !== channel.index)
        .map((index) => (index > channel.index ? index - 1 : index)),
    );
    toast({ title: "Canale eliminato" });
  };

  return (
    <>
      {!isRemote && (
        <div className="space-y-5 bg-background-primary p-4 text-text-primary md:hidden dark:bg-[#101010] dark:text-zinc-100">
          <div className="space-y-3">
            <Label className="text-lg text-text-primary dark:text-zinc-200">
              Add Contact by URL
            </Label>
            <Input
              placeholder="Contact URL"
              value={contactUrl}
              onChange={(event) => setContactUrl(event.target.value)}
              className="h-14 border-zinc-400 bg-transparent text-lg text-text-primary dark:border-zinc-600 dark:text-zinc-100"
            />
            <Button
              disabled={!validContactUrl}
              onClick={importContact}
              className="h-12 w-full bg-background-secondary text-lg text-text-primary disabled:opacity-45 dark:bg-[#303030] dark:text-zinc-100"
            >
              Aggiungere
            </Button>
          </div>

          <div className="space-y-2">
            {visibleChannels.map((effectiveChannel) => {
              const checked = selectedChannels.includes(effectiveChannel.index);
              if (editingChannels) {
                return (
                  <div
                    key={effectiveChannel.index}
                    className="flex w-full items-center gap-3 rounded-md bg-background-secondary px-4 py-4 text-left text-lg dark:bg-[#2d2d2d]"
                  >
                    <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-slate-300 text-sm text-slate-900 dark:bg-[#353535] dark:text-zinc-200">
                      {effectiveChannel.index}
                    </span>
                    <button
                      type="button"
                      className="h-12 min-w-0 flex-1 rounded-md border border-zinc-400 bg-transparent px-3 text-left text-base text-text-primary dark:border-zinc-600 dark:text-zinc-100"
                      onClick={() => setMobileEditChannelIndex(effectiveChannel.index)}
                    >
                      <span className="block truncate">{getChannelName(effectiveChannel)}</span>
                    </button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={effectiveChannel.index === 0}
                      onClick={() => deleteChannelDraft(effectiveChannel)}
                      className="h-12 border-[#8d0606] px-3 text-[#8d0606] disabled:opacity-40"
                    >
                      Elimina
                    </Button>
                  </div>
                );
              }

              return (
                <button
                  key={effectiveChannel.index}
                  type="button"
                  onClick={() =>
                    setSelectedChannels((current) =>
                      checked
                        ? current.filter((index) => index !== effectiveChannel.index)
                        : [...current, effectiveChannel.index],
                    )
                  }
                  className="flex w-full items-center gap-3 rounded-md bg-background-secondary px-4 py-4 text-left text-lg dark:bg-[#2d2d2d]"
                >
                  <span className="inline-flex size-10 items-center justify-center rounded-full bg-slate-300 text-sm text-slate-900 dark:bg-[#353535] dark:text-zinc-200">
                    {effectiveChannel.index}
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    {getChannelName(effectiveChannel)}
                  </span>
                  <Checkbox checked={checked} onChange={() => undefined} />
                </button>
              );
            })}
          </div>

          {editingChannels && (
            <Button
              type="button"
              variant="outline"
              disabled={visibleChannels.length >= MAX_CHANNELS}
              onClick={() => addChannelDraft(true)}
              className="h-12 w-full border-zinc-600 bg-transparent text-lg text-text-primary disabled:opacity-45 dark:text-zinc-100"
            >
              <PlusIcon className="mr-2 size-5" />
              Aggiungi canale
            </Button>
          )}

          {standalone && editingChannels ? null : (
            <Button
              variant="outline"
              onClick={() => setEditingChannels((current) => !current)}
              className="h-12 w-full border-zinc-600 bg-transparent text-lg text-text-primary dark:text-zinc-100"
            >
              {editingChannels ? "Fine modifica" : "Modifica"}
            </Button>
          )}

          {standalone && editingChannels ? (
            <div className="grid grid-cols-2 gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={resetStandaloneChanges}
                className="h-12 text-lg"
              >
                Annulla
              </Button>
              <Button
                type="button"
                disabled={!hasStandaloneChanges || isSavingChannels}
                onClick={() => void saveStandaloneChanges()}
                className="h-12 bg-[#8d0606] text-lg text-white disabled:opacity-45"
              >
                Salva
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant={!qrCodeAdd ? "default" : "outline"}
                onClick={() => setQrCodeAdd(false)}
                className="h-12 border-[#8d0606] bg-[#8d0606] text-lg text-white"
              >
                Replace
              </Button>
              <Button
                variant={qrCodeAdd ? "default" : "outline"}
                onClick={() => setQrCodeAdd(true)}
                className="h-12 border-[#8d0606] bg-[#8d0606] text-lg text-white"
              >
                Add
              </Button>
            </div>
          )}

          <div className="bg-white p-3">
            <QRCode value={qrCodeUrl} size={260} qrStyle="squares" />
          </div>

          <div className="space-y-2">
            <Label className="text-text-secondary dark:text-zinc-300">URL</Label>
            <div className="flex gap-2">
              <Input
                readOnly
                value={qrCodeUrl}
                className="h-14 border-zinc-400 bg-transparent text-base text-text-primary dark:border-zinc-600 dark:text-zinc-100"
              />
              <Button
                variant="outline"
                className="h-14 border-zinc-700 bg-transparent px-4"
                onClick={() => void navigator.clipboard?.writeText(qrCodeUrl)}
              >
                <CopyIcon className="size-5" />
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            <Input
              placeholder="Channels URL"
              value={channelImportUrl}
              onChange={(event) => setChannelImportUrl(event.target.value)}
              className="h-14 border-zinc-400 bg-transparent text-lg text-text-primary dark:border-zinc-600 dark:text-zinc-100"
            />
            <Button
              disabled={!validChannelUrl || isSavingChannels}
              onClick={importChannels}
              className="h-12 w-full bg-[#8d0606] text-lg text-white disabled:opacity-45"
            >
              Ok
            </Button>
          </div>
        </div>
      )}

      <Tabs
        value={`channel_${selectedDesktopChannel?.index ?? 0}`}
        onValueChange={(value) => {
          const nextIndex = Number.parseInt(value.replace("channel_", ""), 10);
          if (!Number.isNaN(nextIndex)) {
            setSelectedChannelIndex(nextIndex);
          }
        }}
        className="max-md:hidden"
      >
        <TabsList className="w-full gap-1 dark:bg-slate-700">
          {visibleChannels.map((channel) => (
            <TabsTrigger
              key={`channel_${channel.index}`}
              value={`channel_${channel.index}`}
              className="dark:text-white relative"
            >
              {getChannelName(channel)}
              {flags.get(channel.index) && (
                <span className="absolute -top-0.5 -right-0.5 z-50 flex size-3">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-500 opacity-25" />
                  <span className="relative inline-flex size-3 rounded-full bg-sky-500" />
                </span>
              )}
            </TabsTrigger>
          ))}
          <Button
            type="button"
            variant="outline"
            disabled={visibleChannels.length >= MAX_CHANNELS}
            className="ml-auto h-8"
            onClick={() => addChannelDraft(false)}
          >
            <PlusIcon className="mr-2" size={14} />
            Aggiungi
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!selectedDesktopChannel || selectedDesktopChannel.index === 0}
            className="h-8"
            onClick={() => selectedDesktopChannel && deleteChannelDraft(selectedDesktopChannel)}
          >
            <Trash2Icon className="mr-2" size={14} />
            Elimina
          </Button>
          {!isRemote && (
            <Button className="h-8" onClick={() => setDialogOpen("import", true)}>
              <UploadIcon className="mr-2" size={14} />
              {t("page.import")}
            </Button>
          )}
          {!isRemote && (
            <Button className=" h-8" onClick={() => setDialogOpen("QR", true)}>
              <QrCodeIcon className="mr-2" size={14} />
              {t("page.export")}
            </Button>
          )}
        </TabsList>
        {standalone && hasStandaloneChanges && (
          <div className="mt-3 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={resetStandaloneChanges}>
              Annulla
            </Button>
            <Button
              type="button"
              disabled={isSavingChannels}
              onClick={() => void saveStandaloneChanges()}
            >
              Salva
            </Button>
          </div>
        )}
        {visibleChannels.map((channel) => (
          <TabsContent key={`channel_${channel.index}`} value={`channel_${channel.index}`}>
            <Suspense fallback={<Spinner size="lg" className="my-5" />}>
              <Channel key={channel.index} onFormInit={onFormInit} channel={channel} />
            </Suspense>
          </TabsContent>
        ))}
      </Tabs>

      <Dialog
        open={mobileEditChannelIndex !== undefined}
        onOpenChange={(open) => {
          if (!open) setMobileEditChannelIndex(undefined);
        }}
      >
        <DialogContent className="inset-0 h-dvh max-h-dvh w-screen max-w-none rounded-none bg-background-primary p-0 text-text-primary dark:bg-[#101010] dark:text-zinc-100 sm:max-w-none sm:rounded-none">
          {mobileEditChannelIndex !== undefined ? (
            <MobileChannelEditor
              channel={getEffectiveChannel(
                visibleChannels.find((channel) => channel.index === mobileEditChannelIndex) ??
                  visibleChannels[0]!,
              )}
              getName={getChannelName}
              onClose={() => setMobileEditChannelIndex(undefined)}
              onUpdate={updateMobileChannelSettings}
              onDelete={deleteChannelDraft}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
};

function MobileChannelEditor({
  channel,
  getName,
  onClose,
  onUpdate,
  onDelete,
}: {
  channel: Protobuf.Channel.Channel;
  getName: (channel: Protobuf.Channel.Channel) => string;
  onClose: () => void;
  onUpdate: (
    channel: Protobuf.Channel.Channel,
    patch: Partial<Protobuf.Channel.ChannelSettings>,
  ) => void;
  onDelete: (channel: Protobuf.Channel.Channel) => void;
}) {
  const { toast } = useToast();
  const [draftSettings, setDraftSettings] = useState(() => cloneChannelSettings(channel.settings));
  const [draftPsk, setDraftPsk] = useState(() =>
    fromByteArray(channel.settings?.psk ?? new Uint8Array(0)),
  );
  const positionPrecision = draftSettings.moduleSettings?.positionPrecision ?? 10;

  const updateDraft = (patch: Partial<Protobuf.Channel.ChannelSettings>) => {
    setDraftSettings((current) => {
      return mergeChannelSettings(current, patch);
    });
  };

  const saveDraft = () => {
    let psk = draftSettings.psk;
    try {
      psk = toByteArray(draftPsk);
    } catch {
      toastInvalidPsk();
      return;
    }
    const nextSettings = mergeChannelSettings(draftSettings, {
      psk,
    });
    onUpdate(channel, nextSettings);
    onClose();
  };

  const toastInvalidPsk = () => {
    toast({ title: "PSK non valida", description: "Inserire una stringa base64 valida." });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-zinc-800 bg-[#202020] px-4 py-3 text-zinc-100">
        <button type="button" className="rounded-full p-2 hover:bg-white/10" onClick={onClose}>
          <ArrowLeftIcon className="size-6" />
        </button>
        <DialogTitle className="min-w-0 text-lg font-semibold">
          <span className="block truncate">Canale {channel.index}</span>
          <span className="block truncate text-sm font-normal text-zinc-300">
            {getName(channel)}
          </span>
        </DialogTitle>
      </div>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
        <div className="space-y-2">
          <Label>Nome canale</Label>
          <Input
            value={draftSettings.name ?? ""}
            placeholder={getName(channel)}
            onChange={(event) => updateDraft({ name: event.target.value })}
            className="h-12 bg-transparent"
          />
        </div>
        <div className="space-y-2">
          <Label>PSK</Label>
          <Input
            value={draftPsk}
            onChange={(event) => setDraftPsk(event.target.value)}
            className="h-12 bg-transparent font-mono text-sm"
          />
        </div>
        <div className="space-y-2">
          <Label>Precisione posizione</Label>
          <select
            value={positionPrecision}
            onChange={(event) =>
              updateDraft({
                moduleSettings: create(Protobuf.Channel.ModuleSettingsSchema, {
                  positionPrecision: Number(event.target.value),
                  isClientMuted: draftSettings.moduleSettings?.isClientMuted,
                }),
              })
            }
            className="h-12 w-full rounded-md border border-zinc-400 bg-transparent px-3 dark:border-zinc-600"
          >
            <option value={0}>Nessuna</option>
            <option value={10}>23 km</option>
            <option value={12}>5.8 km</option>
            <option value={15}>700 m</option>
            <option value={19}>50 m</option>
            <option value={32}>Precisa</option>
          </select>
        </div>
        <MobileChannelToggle
          label="Invio posizione / uplink MQTT"
          checked={Boolean(draftSettings.uplinkEnabled)}
          onChange={(checked) => updateDraft({ uplinkEnabled: checked })}
        />
        <MobileChannelToggle
          label="Ricezione dati / downlink MQTT"
          checked={Boolean(draftSettings.downlinkEnabled)}
          onChange={(checked) => updateDraft({ downlinkEnabled: checked })}
        />
        <Button
          type="button"
          variant="outline"
          disabled={channel.index === 0}
          className="h-12 w-full border-[#8d0606] text-[#8d0606] disabled:opacity-40"
          onClick={() => {
            onDelete(channel);
            onClose();
          }}
        >
          Elimina canale
        </Button>
        <div className="grid grid-cols-2 gap-3 pb-6">
          <Button type="button" variant="outline" className="h-12" onClick={onClose}>
            Annulla
          </Button>
          <Button type="button" className="h-12 bg-[#8d0606] text-white" onClick={saveDraft}>
            Salva
          </Button>
        </div>
      </div>
    </div>
  );
}

function MobileChannelToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between rounded-md bg-background-secondary px-4 py-3 dark:bg-[#252525]">
      <span>{label}</span>
      <Checkbox checked={checked} onChange={onChange} />
    </label>
  );
}
