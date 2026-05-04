# DMDash

*`DMDash` è una dashboard web orientata a DarkMesh costruita sopra il client web Meshtastic.*

Questo repository usa `meshtastic/web` come base tecnica, applica branding e UX DarkMesh, e mantiene la compatibilità con il contratto protobuf ufficiale di Meshtastic in modo che la dashboard rimanga interoperabile con l'ecosistema Meshtastic.

## Obiettivo del progetto

L'obiettivo di `DMDash` è fornire una dashboard web-first DarkMesh che:

- preservi la compatibilità con il protocollo Meshtastic
- riutilizzi il runtime web, i trasporti e il modello dati di Meshtastic
- porti i flussi utente specifici DarkMesh dall'app Android al browser
- rimanga allineata al branch firmware DarkMesh `2.7.15-ghost`

## Cosa puoi fare oggi

La build attuale di DMDash espone queste funzionalità reali lato utente sopra la base Meshtastic web:

- gestore connessioni con trasporti `HTTP(S)`, Web Bluetooth e Web Serial
- dashboard DarkMesh con notifiche, storico traceroute, regole per messaggi schedulati, beacon distress, forwarding hunt e strumenti di manutenzione NodeDB
- import/export `.dmdb` basato su `SharedContact` di Meshtastic
- messaggi diretti e broadcast con reply, mention, reazioni, emoji picker, indicatori di compressione e avatar cliccabili
- visualizzazione dello `Status Message` in chat e badge sugli avatar con stato non letto / letto
- mappa con marker live, popup nodo, dialog dettagli, neighbor info, metriche ambientali e overlay traceroute
- lista nodi con filtri, preferiti, visibilita del segnale, stato cifratura e accesso rapido ai dettagli
- impostazioni locali `Radio`, `Device` e `Module` con visibilita tab dipendente dal firmware
- Remote Admin per configurazioni `Radio`, `Device` e `Module` sui nodi remoti compatibili
- copertura dei moduli come `Remote Hardware`, `Status Message` e `Traffic Management` quando il firmware li supporta

La disponibilita effettiva di alcune funzioni dipende comunque da browser, trasporto scelto, firmware del nodo e ruolo del device.

## Documentazione utente

La guida per utenti meno tecnici e ora servita direttamente dal build web:

- pagina iniziale guida: [packages/web/public/guide/index.html](packages/web/public/guide/index.html)
- guida in inglese: [packages/web/public/guide/en/index.html](packages/web/public/guide/en/index.html)
- guida in italiano: [packages/web/public/guide/it/index.html](packages/web/public/guide/it/index.html)

Quando l'app web gira in locale, basta aprire `/guide/index.html` sullo stesso host, ad esempio:

```text
http://localhost:3000/guide/index.html
```

### Anteprime delle funzionalità

Di seguito alcune anteprime rapide delle feature principali della dashboard DarkMesh; clicca la miniatura per vedere l'immagine a dimensione intera.

- **Messaggi (chat / emoji picker)**  
  [![Messaggi](assets/screenshots/Chat-thumb.png)](assets/screenshots/Chat.png)
- **Mappa (panoramica + popup nodo)**  
  [![Mappa](assets/screenshots/EnvironmentalMetrics-thumb.png)](assets/screenshots/EnvironmentalMetrics.png)
- **Filtri mappa (role/metrics UI)**  
  [![Filtri](assets/screenshots/Filters-thumb.png)](assets/screenshots/Filters.png)
- **Popup nodo (lista neighbor / metriche)**  
  [![Popup nodo](assets/screenshots/NeighborNodes-thumb.png)](assets/screenshots/NeighborNodes.png)
- **Traceroute overlay (visual tracert)**  
  [![Traceroute](assets/screenshots/VisualTraceroute-thumb.png)](assets/screenshots/VisualTraceroute.png)

## Compatibilità del protocollo

`DMDash` non introduce un fork protobuf separato.

Il modello di compatibilità è:

- il branch firmware `2.7.15-ghost` di `DarkMesh-Firmware` è il riferimento firmware
- `DarkMesh-Firmware` punta il suo `protobufs/` al repository protobuf ufficiale di Meshtastic
- quindi `DMDash` mantiene lo schema protobuf ufficiale di Meshtastic come fonte di verità

Per l'analisi e lo stato corrente, vedi:

- [docs/darkmesh-analysis.md](docs/darkmesh-analysis.md)
- [docs/compatibility-matrix.md](docs/compatibility-matrix.md)
- [docs/compatibility-report.md](docs/compatibility-report.md)

## Strategia upstream

Questo progetto traccia più repository upstream, con ruoli differenti:

- `upstream-web`
  - base Meshtastic web
  - unico upstream pensato per essere fuso nella tree della dashboard
- `upstream-protobufs`
  - riferimento per la compatibilità del protocollo
- `upstream-darkmesh-android`
  - riferimento funzionalità/UX DarkMesh
- `upstream-darkmesh-firmware`
  - riferimento comportamento firmware

Policy e dettagli sono documentati in [docs/upstream-policy.md](docs/upstream-policy.md).

## Layout del repository

- `packages/web`
  - l'applicazione web vera e propria
- `packages/core`
  - logica core JS Meshtastic usata dalla dashboard
- `docs`
  - analisi DarkMesh, compatibilità e policy upstream
- `scripts`
  - helper per sync upstream e report di compatibilità
- `external-sources`
  - cloni locali dei repository upstream usati per analisi e sync
  - esclusi intenzionalmente dal tracking git in questo repository

## Sviluppo

### Prerequisiti

- `pnpm`
- Node.js compatibile con le dipendenze del workspace

### Installazione

```bash
pnpm install
```

### Avviare la dashboard web

```bash
pnpm --filter meshtastic-web dev
```

### Typecheck

Typecheck focalizzato sul runtime:

```bash
pnpm --filter meshtastic-web typecheck
```

Typecheck completo dei package (inclusi tests e file di supporto):

```bash
pnpm exec tsc --noEmit -p packages/web/tsconfig.json
```

### Build

```bash
pnpm --filter meshtastic-web build
```

## Script utili

Il repository espone diversi script di utilità nel `package.json` di root. Alcuni comandi utili:

- **Installare prerequisiti**: `pnpm install`
- **Avviare dev server (web package)**: `pnpm --filter meshtastic-web dev`
- **Typecheck (runtime)**: `pnpm --filter meshtastic-web typecheck`
- **Typecheck completo**: `pnpm exec tsc --noEmit -p packages/web/tsconfig.json`
- **Build di tutti i package**: `pnpm run build:all`
- **Pulire tutti i package**: `pnpm run clean:all`
- **Sincronizzare upstream**: `pnpm sync:upstreams`
- **Aggiornare upstream (fast-forward se pulito)**: `pnpm sync:upstreams:update`
- **Rigenerare report di compatibilità**: `pnpm report:compatibility`
- **Lint**: `pnpm run lint` e `pnpm run lint:fix`
- **Format**: `pnpm run format` e `pnpm run format:fix`
- **Check (lint + format)**: `pnpm run check` e `pnpm run check:fix`
- **Eseguire test**: `pnpm run test`

## Note runtime del browser

Alcuni comportamenti dell'app Android DarkMesh dipendono da servizi foreground a lunga esecuzione. Nella dashboard web queste funzionalità operano mentre la tab del browser è aperta e connessa:

- messaggi schedulati e invii basati su regole
- loop del beacon di distress
- forwarding hunting
- polling notifiche legato alla sessione browser attiva

Questa è un'approssimazione intenzionale lato browser, non una rottura del protocollo.

Anche alcune sezioni di Settings e Remote Admin possono comparire o sparire in base al firmware e al ruolo del nodo target.

## Stato verificato

Allo stato attuale del repository:

- il runtime in `packages/web` passa i typecheck
- il typecheck completo di `packages/web` passa
- la build di produzione passa
- i test mirati alle aree adattate passano

## Repository upstream referenziati

- DarkMesh Android: `https://github.com/emp3r0r7/DarkMesh.git`
- DarkMesh Firmware: `https://github.com/emp3r0r7/DarkMesh-Firmware.git`
- Meshtastic Protobufs: `https://github.com/meshtastic/protobufs.git`
- Meshtastic Web: `https://github.com/meshtastic/web.git`

## Identità del progetto

`DMDash` è un progetto dashboard DarkMesh con un core tecnico compatibile Meshtastic.

Trattalo come:

- un'esperienza web DarkMesh
- una dashboard compatibile Meshtastic
- un repository che segue upstream in modo intenzionale invece di mescolare tutte le storie dei commit

## Screenshots

Le immagini usate in questo README sono presenti in `assets/screenshots/`:

- `assets/screenshots/Chat.png` — anteprima messaggi/chat
- `assets/screenshots/EnvironmentalMetrics.png` — popup nodo / metriche
- `assets/screenshots/Filters.png` — UI filtri mappa
- `assets/screenshots/NeighborNodes.png` — lista neighbor nel popup nodo
- `assets/screenshots/VisualTraceroute.png` — overlay traceroute sulla mappa

## Screenshot disponibili

Le immagini attualmente referenziate da questo README si trovano in `assets/screenshots/`:

- `assets/screenshots/Chat.png` — anteprima messaggi/chat
- `assets/screenshots/EnvironmentalMetrics.png` — popup nodo / metriche
- `assets/screenshots/Filters.png` — UI filtri mappa
- `assets/screenshots/NeighborNodes.png` — lista neighbor nel popup nodo
- `assets/screenshots/VisualTraceroute.png` — overlay traceroute sulla mappa

## Aggiornamenti UX recenti

Gli ultimi aggiornamenti hanno aggiunto o stabilizzato queste aree:

- avatar messaggi cliccabili che aprono i dettagli nodo
- preview reply che porta al messaggio originale
- evidenziazione mention e miglioramenti al flusso reply
- rendering dello status message in popup, dialog, header chat e avatar nodo
- badge avatar per status message non letto / letto
- copertura moduli per `Status Message`, `Traffic Management` e `Remote Hardware`
- workflow notifiche batteria e power dal dashboard DarkMesh
