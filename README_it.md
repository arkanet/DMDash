# DMDash

*`DMDash` è una dashboard web orientata a DarkMesh costruita sopra il client web Meshtastic.*

Questo repository usa `meshtastic/web` come base tecnica, applica branding e UX DarkMesh, e mantiene la compatibilità con il contratto protobuf ufficiale di Meshtastic in modo che la dashboard rimanga interoperabile con l'ecosistema Meshtastic.

## Obiettivo del progetto

L'obiettivo di `DMDash` è fornire una dashboard web-first DarkMesh che:

- preservi la compatibilità con il protocollo Meshtastic
- riutilizzi il runtime web, i trasporti e il modello dati di Meshtastic
- porti i flussi utente specifici DarkMesh dall'app Android al browser
- rimanga allineata ai branch firmware DarkMesh `2.7.15-ghost`, `2.7.21-ghost` e `2.7.26-darkmesh`, confrontandosi anche con le dichiarazioni hardware del firmware Meshtastic

## Cosa puoi fare oggi

La build attuale di DMDash espone queste funzionalità reali lato utente sopra la base Meshtastic web:

- gestore connessioni con trasporti `HTTP(S)`, Web Bluetooth e Web Serial
- dashboard DarkMesh con notifiche, Mesh Stats, storico traceroute, regole per messaggi schedulati, beacon distress, forwarding hunt e strumenti di manutenzione NodeDB
- import/export `.dmdb` basato su `SharedContact` di Meshtastic
- messaggi diretti e broadcast con reply, mention, reazioni, emoji picker, compressione Unishox2 lato app, fallback compressione firmware legacy, indicatori di compressione e avatar cliccabili
- visualizzazione dello `Status Message` in chat e badge sugli avatar con stato non letto / letto
- mappa con marker live, popup nodo, dialog dettagli, neighbor info, metriche ambientali e overlay traceroute
- lista nodi con filtri, preferiti, visibilita del segnale, stato cifratura, accesso rapido ai dettagli e ricerca mobile tramite long press da mappa e widget gateway
- impostazioni locali `Radio`, `Device` e `Module` con visibilita tab dipendente dal firmware
- Remote Admin per configurazioni `Radio`, `Device` e `Module` sui nodi remoti compatibili, inclusa la navbar padre in mobile
- copertura dei moduli come `Remote Hardware`, `Status Message` e `Traffic Management` quando il firmware li supporta
- icone web DarkMesh bianche su sfondo nero per favicon, Apple touch icon e installazione PWA

La disponibilita effettiva di alcune funzioni dipende comunque da browser, trasporto scelto, firmware del nodo e ruolo del device.

## Documentazione utente

La guida per utenti meno tecnici è servita direttamente dal build web. La landing della guida funziona anche come demo leggera delle aree e dei workflow attualmente coperti:

- route demo / guida nell'app: `/guide`
- landing statica: [packages/web/public/guide/index.html](packages/web/public/guide/index.html)
- guida in inglese: [packages/web/public/guide/en/index.html](packages/web/public/guide/en/index.html)
- guida in italiano: [packages/web/public/guide/it/index.html](packages/web/public/guide/it/index.html)

Quando l'app web gira in locale, basta aprire `/guide` sullo stesso host:

```text
http://localhost:3000/guide
```

Anche i percorsi compatibili con asset statici `/guide/index.html`, `/guide/en/index.html` e `/guide/it/index.html` sono gestiti dalla route React, quindi la demo può essere linkata da una homepage deployata senza regole server speciali.

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

- i branch firmware `2.7.15-ghost`, `2.7.21-ghost` e `2.7.26-darkmesh` di `DarkMesh-Firmware` sono i riferimenti firmware DarkMesh
- `meshtastic/firmware` `master` è il riferimento Meshtastic per le dichiarazioni hardware
- `DarkMesh-Firmware` punta il suo `protobufs/` al repository protobuf ufficiale di Meshtastic
- quindi `DMDash` mantiene lo schema protobuf ufficiale di Meshtastic come fonte di verità

### Compatibilità dei messaggi compressi

DarkMesh firmware `2.7.26-darkmesh` sposta la compressione testo nel livello applicazione. DMDash segue questo modello come default:

- il testo compresso in uscita viene compresso nel web client con Unishox2 e inviato su `TEXT_MESSAGE_COMPRESSED_APP`
- i payload `TEXT_MESSAGE_COMPRESSED_APP` in ingresso vengono decodificati nel web client quando contengono dati compressi lato app
- la compressione firmware legacy resta disponibile con la modalita `remote`, che continua a inviare testo chiaro sulla porta compressa per i firmware piu vecchi che gestiscono ancora la compressione autonomamente
- i payload testo ricevuti sulla porta compressa restano leggibili per retrocompatibilita
- i metadati dei messaggi preservano `compressed`, `compressionMode`, `savedBytes` e la stima del tempo radio risparmiato quando disponibili

Il gate di compatibilita considera i firmware `2.7.26+` capaci di compressione lato app. Firmware piu vecchi o non identificati possono ancora esporre l'opzione legacy lato firmware.

Per l'analisi e lo stato corrente, vedi:

- [docs/darkmesh-analysis.md](docs/darkmesh-analysis.md)
- [docs/compatibility-matrix.md](docs/compatibility-matrix.md)
- [docs/compatibility-report.md](docs/compatibility-report.md)
- [docs/device-image-coverage.md](docs/device-image-coverage.md)
- [docs/pictures-sync.md](docs/pictures-sync.md)
- [CHANGELOG.md](CHANGELOG.md)

## Strategia upstream

Questo progetto traccia più repository upstream, con ruoli differenti:

- `upstream-web`
  - base Meshtastic web
  - unico upstream pensato per essere fuso nella tree della dashboard
- `upstream-protobufs`
  - riferimento per la compatibilità del protocollo
- `upstream-firmware`
  - riferimento firmware Meshtastic per le dichiarazioni hardware
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
- **Rigenerare report copertura DeviceImage**: `pnpm report:device-images`
- **Applicare il guardrail DeviceImage**: `pnpm check:device-images`
- **Lint**: `pnpm run lint` e `pnpm run lint:fix`
- **Format**: `pnpm run format` e `pnpm run format:fix`
- **Check (lint + format)**: `pnpm run check` e `pnpm run check:fix`
- **Eseguire test**: `pnpm run test`

## Workflow sync upstream

Aggiornare remote e mirror locali:

```bash
pnpm sync:upstreams
```

Aggiornare remote e fare fast-forward dei mirror locali quando sono puliti:

```bash
pnpm sync:upstreams:update
```

Rigenerare lo snapshot di compatibilità:

```bash
pnpm report:compatibility
```

Rigenerare il report di copertura DeviceImage:

```bash
pnpm report:device-images
```

Eseguire il guardrail bloccante per la copertura DeviceImage:

```bash
pnpm check:device-images
```

## Note runtime del browser

Alcuni comportamenti dell'app Android DarkMesh dipendono da servizi foreground a lunga esecuzione. Nella dashboard web queste funzionalità operano mentre la tab del browser è aperta e connessa:

- messaggi schedulati e invii basati su regole
- loop del beacon di distress
- forwarding hunting
- polling notifiche legato alla sessione browser attiva

Questa è un'approssimazione intenzionale lato browser, non una rottura del protocollo.

L'app web è configurata come PWA con manifest adatto a iOS, metadata Apple touch icon, Service Worker root, cache runtime offline e banner di installazione personalizzato per iPhone/iPad. Il supporto Web Push è presente lato client e Service Worker; configura queste variabili di deploy per registrare le subscription nel tuo backend push:

- `VITE_WEB_PUSH_PUBLIC_KEY`
- `VITE_WEB_PUSH_SUBSCRIBE_URL`
- `VITE_WEB_PUSH_UNSUBSCRIBE_URL`

Su iOS/iPadOS, Web Push richiede che il sito sia installato sulla Home Screen e aperto come web app standalone. iOS continua a non esporre Web Bluetooth a Safari o alle PWA installate, quindi le connessioni Bluetooth richiedono un browser/piattaforma con Web Bluetooth oppure un wrapper/app companion nativa basata su CoreBluetooth.

Anche alcune sezioni di Settings e Remote Admin possono comparire o sparire in base al firmware e al ruolo del nodo target.

Anche la modalita di compressione e firmware-aware: DMDash preferisce la compressione lato app per `2.7.26-darkmesh` e firmware compatibili piu recenti, mantenendo la richiesta di compressione lato firmware per i nodi DarkMesh legacy.

## Stato verificato

Allo stato attuale del repository:

- il runtime in `packages/web` passa i typecheck
- il typecheck completo di `packages/web` passa
- la build di produzione passa
- i test mirati alle aree adattate passano

## Repository upstream referenziati

- DarkMesh Android: `https://github.com/emp3r0r7/DarkMesh.git`
- DarkMesh Firmware: `https://github.com/emp3r0r7/DarkMesh-Firmware.git`
- Meshtastic Firmware: `https://github.com/meshtastic/firmware.git`
- Meshtastic Protobufs: `https://github.com/meshtastic/protobufs.git`
- Meshtastic Web: `https://github.com/meshtastic/web.git`

## Identità del progetto

`DMDash` è un progetto dashboard DarkMesh con un core tecnico compatibile Meshtastic.

Trattalo come:

- un'esperienza web DarkMesh
- una dashboard compatibile Meshtastic
- un repository che segue upstream in modo intenzionale invece di mescolare tutte le storie dei commit

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
- Mesh Stats nel menu Extra mobile, con contatori traceroute e compressione
- compressione Unishox2 lato app con fallback firmware legacy
- decompressione Unishox2 protetta, evitando di mostrare payload non validi come testo illeggibile
- ricerca nodo mobile tramite long press da Relay Confidence, marker mappa, tab nodo e card nodo
- menu Extra mobile piu compatto, senza search/footer padding e con sfondo nero in modalita scura
- favicon, Apple touch icon e icone PWA DarkMesh

## Changelog documentazione

Aggiornamenti recenti visibili nei README:

- aggiunto [CHANGELOG.md](CHANGELOG.md) con gli ultimi 7 commit su `fix-update`
- documentata la route demo/guida nell'app su `/guide`, con percorsi static-compatible `/guide/index.html`
- aggiunto il report di copertura DeviceImage e i comandi guardrail
- esteso il tracking upstream includendo le dichiarazioni hardware del firmware Meshtastic
- aggiornata la compatibilità per DarkMesh `2.7.15-ghost`, DarkMesh `2.7.21-ghost`, DarkMesh `2.7.26-darkmesh` e firmware Meshtastic
- aggiunte le note sulla compatibilita della compressione Unishox2 lato app e della modalita legacy lato firmware
