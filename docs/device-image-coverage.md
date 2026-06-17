# Device Image Coverage Report

Generated at 2026-06-17T14:30:47.846Z from the local DMDash workspace.

## Inputs

- DeviceImage map: `packages/web/src/components/generic/DeviceImage.tsx`
- Device assets: `packages/web/public/devices`
- Local protobuf enum: `packages/protobufs/meshtastic/mesh.proto`
- Upstream protobuf enum: `external-sources/meshtastic-protobufs/meshtastic/mesh.proto`

## Source Snapshot

| Source | Firmware | Status | Ref | Commit | Declared hardware | Enum values |
| --- | --- | --- | --- | --- | --- | --- |
| darkmesh-firmware-2.7.15-ghost | DarkMesh | ok | origin/2.7.15-ghost | fd3755f7 | 107 | 119 |
| darkmesh-firmware-2.7.21-ghost | DarkMesh | ok | origin/2.7.21-ghost | 6e4cf387 | 115 | 129 |
| meshtastic-firmware-master | Meshtastic | ok | origin/master | ca1304e6d | 121 | 140 |

## Summary

| Metric | Count |
| --- | --- |
| DeviceImage mappings | 61 |
| Device asset files | 42 |
| Firmware-declared hardware models | 122 |
| Required firmware models | 119 |
| Missing DeviceImage mappings | 70 |
| Mappings pointing to missing files | 0 |
| Firmware hardware declaration missing from firmware enum | 2 |
| Firmware enum number conflicts | 0 |
| Firmware/local protobuf number-name mismatches | 1 |
| Local protobuf models without DeviceImage mapping | 84 |
| Mapped models not declared by inspected firmware | 11 |
| Firmware image metadata models | 65 |
| Firmware image metadata gaps | 35 |
| Firmware-declared image files missing locally | 39 |
| Unused asset files | 0 |

## Missing Firmware DeviceImage Mappings

| HardwareModel | Number | Firmware sources | Source reference | Producer/source hint |
| --- | --- | --- | --- | --- |
| BETAFPV_2400_TX | 45 | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | darkmesh-firmware-2.7.15-ghost:src/platform/esp32/architecture.h:139, darkmesh-firmware-2.7.21-ghost:src/platform/esp32/architecture.h:134 | betafpv.com |
| BETAFPV_900_NANO_TX | 46 | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | darkmesh-firmware-2.7.15-ghost:src/platform/esp32/architecture.h:143, darkmesh-firmware-2.7.21-ghost:src/platform/esp32/architecture.h:138 | betafpv.com |
| CANARYONE | 29 | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | darkmesh-firmware-2.7.15-ghost:src/platform/nrf52/architecture.h:74, darkmesh-firmware-2.7.21-ghost:src/platform/nrf52/architecture.h:101 | https://canaryradio.io/products/canaryone |
| CDEBYTE_EORA_S3 | 61 | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | darkmesh-firmware-2.7.15-ghost:src/platform/esp32/architecture.h:137, darkmesh-firmware-2.7.21-ghost:src/platform/esp32/architecture.h:132 | - |
| CHATTER_2 | 56 | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | darkmesh-firmware-2.7.15-ghost:src/platform/esp32/architecture.h:161, darkmesh-firmware-2.7.21-ghost:src/platform/esp32/architecture.h:156 | - |
| CROWPANEL | 97 | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | darkmesh-firmware-2.7.15-ghost:src/platform/esp32/architecture.h:191, darkmesh-firmware-2.7.21-ghost:src/platform/esp32/architecture.h:186 | elecrow.com |
| DR_DEV | 41 | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | darkmesh-firmware-2.7.15-ghost:src/platform/esp32/architecture.h:115, darkmesh-firmware-2.7.21-ghost:src/platform/esp32/architecture.h:110 | https://github.com/sudomesh/disaster-radio/tree/master/hardware/board_esp32_v3 |
| EBYTE_ESP32_S3 | 54 | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | darkmesh-firmware-2.7.15-ghost:src/platform/esp32/architecture.h:149, darkmesh-firmware-2.7.21-ghost:src/platform/esp32/architecture.h:144 | - |
| ESP32_S3_PICO | 55 | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | darkmesh-firmware-2.7.15-ghost:src/platform/esp32/architecture.h:155, darkmesh-firmware-2.7.21-ghost:src/platform/esp32/architecture.h:150 | waveshare.com |
| GAT562_MESH_TRIAL_TRACKER | - | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | darkmesh-firmware-2.7.15-ghost:src/platform/nrf52/architecture.h:55, darkmesh-firmware-2.7.21-ghost:src/platform/nrf52/architecture.h:74 | - |
| GENIEBLOCKS | 35 | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | darkmesh-firmware-2.7.15-ghost:src/platform/esp32/architecture.h:103, darkmesh-firmware-2.7.21-ghost:src/platform/esp32/architecture.h:100 | - |
| HELTEC_CAPSULE_SENSOR_V3 | 65 | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | darkmesh-firmware-2.7.15-ghost:src/platform/esp32/architecture.h:173, darkmesh-firmware-2.7.21-ghost:src/platform/esp32/architecture.h:168 | heltec.org |
| HELTEC_HRU_3601 | 23 | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | darkmesh-firmware-2.7.15-ghost:src/platform/esp32/architecture.h:117, darkmesh-firmware-2.7.21-ghost:src/platform/esp32/architecture.h:112 | https://heltec.org/project/hru-3601/ |
| HELTEC_MESH_NODE_T096 | 127 | darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | darkmesh-firmware-2.7.21-ghost:variants/nrf52840/heltec_mesh_node_t096/platformio.ini:4, meshtastic-firmware-master:variants/nrf52840/heltec_mesh_node_t096/platformio.ini:4 | heltec.org |
| HELTEC_MESH_NODE_T1 | 133 | meshtastic-firmware-master | meshtastic-firmware-master:src/platform/nrf52/architecture.h:125, meshtastic-firmware-master:variants/nrf52840/heltec_mesh_node_t1/platformio.ini:4 | heltec.org |
| HELTEC_MESH_POCKET | 94 | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | darkmesh-firmware-2.7.15-ghost:src/platform/nrf52/architecture.h:100, darkmesh-firmware-2.7.21-ghost:src/platform/nrf52/architecture.h:127 | heltec.org |
| HELTEC_MESH_SOLAR | 108 | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | darkmesh-firmware-2.7.15-ghost:src/platform/nrf52/architecture.h:106, darkmesh-firmware-2.7.21-ghost:src/platform/nrf52/architecture.h:133 | https://heltec.org/project/meshsolar/ |
| HELTEC_SENSOR_HUB | 92 | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | darkmesh-firmware-2.7.15-ghost:src/platform/esp32/architecture.h:189, darkmesh-firmware-2.7.21-ghost:src/platform/esp32/architecture.h:184 | heltec.org |
| HELTEC_V1 | 11 | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | darkmesh-firmware-2.7.15-ghost:src/platform/esp32/architecture.h:85, darkmesh-firmware-2.7.21-ghost:src/platform/esp32/architecture.h:82 | heltec.org |
| HELTEC_WIRELESS_BRIDGE | 24 | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | darkmesh-firmware-2.7.15-ghost:src/platform/esp32/architecture.h:83, darkmesh-firmware-2.7.21-ghost:src/platform/esp32/architecture.h:80 | heltec.org |
| LINK_32 | 98 | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | darkmesh-firmware-2.7.15-ghost:src/platform/esp32/architecture.h:197, darkmesh-firmware-2.7.21-ghost:src/platform/esp32/architecture.h:192 | - |
| M5STACK | 42 | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | darkmesh-firmware-2.7.15-ghost:src/platform/esp32/architecture.h:109, darkmesh-firmware-2.7.21-ghost:src/platform/esp32/architecture.h:104 | https://m5stack.com/ |
| M5STACK_C6L | 111 | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | darkmesh-firmware-2.7.15-ghost:src/platform/esp32/architecture.h:205, darkmesh-firmware-2.7.21-ghost:src/platform/esp32/architecture.h:202 | m5stack.com |
| M5STACK_CARDPUTER_ADV | 112 | darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | darkmesh-firmware-2.7.21-ghost:src/platform/esp32/architecture.h:206, meshtastic-firmware-master:src/platform/esp32/architecture.h:210 | m5stack.com |
| M5STACK_CORES3 | 80 | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | darkmesh-firmware-2.7.15-ghost:src/platform/esp32/architecture.h:111, darkmesh-firmware-2.7.21-ghost:src/platform/esp32/architecture.h:106 | https://m5stack.com/ |
| ME25LS01_4Y10TD | 75 | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | darkmesh-firmware-2.7.15-ghost:src/platform/nrf52/architecture.h:86, darkmesh-firmware-2.7.21-ghost:src/platform/nrf52/architecture.h:113 | minewsemi.com |
| MESHLINK | 87 | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | darkmesh-firmware-2.7.15-ghost:src/platform/nrf52/architecture.h:94, darkmesh-firmware-2.7.21-ghost:src/platform/nrf52/architecture.h:121 | https://www.loraitalia.it |
| MESH_TAB | 86 | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | darkmesh-firmware-2.7.15-ghost:src/platform/esp32/architecture.h:185, darkmesh-firmware-2.7.21-ghost:src/platform/esp32/architecture.h:180 | https://github.com/valzzu/Mesh-Tab |
| MINI_EPAPER_S3 | 125 | darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | darkmesh-firmware-2.7.21-ghost:variants/esp32s3/mini-epaper-s3/platformio.ini:3, meshtastic-firmware-master:variants/esp32s3/mini-epaper-s3/platformio.ini:3 | - |
| MS24SF1 | 82 | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | darkmesh-firmware-2.7.15-ghost:src/platform/nrf52/architecture.h:88, darkmesh-firmware-2.7.21-ghost:src/platform/nrf52/architecture.h:115 | minewsemi.com |
| MUZI_BASE | 93 | darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | darkmesh-firmware-2.7.21-ghost:src/platform/nrf52/architecture.h:135, darkmesh-firmware-2.7.21-ghost:variants/nrf52840/muzi_base/platformio.ini:3 | - |
| MUZI_R1_NEO | 101 | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | darkmesh-firmware-2.7.15-ghost:src/platform/nrf52/architecture.h:59, darkmesh-firmware-2.7.21-ghost:src/platform/nrf52/architecture.h:78 | - |
| NANO_G1 | 14 | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | darkmesh-firmware-2.7.15-ghost:src/platform/esp32/architecture.h:107, darkmesh-firmware-2.7.21-ghost:src/platform/esp32/architecture.h:102 | https://uniteng.com/wiki/doku.php?id=meshtastic:nano |
| NANO_G1_EXPLORER | 17 | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | darkmesh-firmware-2.7.15-ghost:src/platform/esp32/architecture.h:141, darkmesh-firmware-2.7.21-ghost:src/platform/esp32/architecture.h:136 | https://wiki.uniteng.com/en/meshtastic/nano-g1-explorer |
| NOMADSTAR_METEOR_PRO | 96 | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | darkmesh-firmware-2.7.15-ghost:src/platform/nrf52/architecture.h:57, darkmesh-firmware-2.7.21-ghost:src/platform/nrf52/architecture.h:76 | https://nomadstar.ch/ |
| NRF52840DK | 33 | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | darkmesh-firmware-2.7.15-ghost:src/platform/nrf52/architecture.h:45, darkmesh-firmware-2.7.21-ghost:src/platform/nrf52/architecture.h:64 | - |
| NRF52840_PCA10059 | 40 | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | darkmesh-firmware-2.7.15-ghost:src/platform/nrf52/architecture.h:76, darkmesh-firmware-2.7.21-ghost:src/platform/nrf52/architecture.h:103 | https://www.nordicsemi.com/Products/Development-hardware/nrf52840-dongle/ |
| PICOMPUTER_S3 | 52 | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | darkmesh-firmware-2.7.15-ghost:src/platform/esp32/architecture.h:145, darkmesh-firmware-2.7.21-ghost:src/platform/esp32/architecture.h:140 | - |
| PPR | 34 | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | darkmesh-firmware-2.7.15-ghost:src/platform/nrf52/architecture.h:47, darkmesh-firmware-2.7.21-ghost:src/platform/nrf52/architecture.h:66 | - |
| RADIOMASTER_900_BANDIT | 74 | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | darkmesh-firmware-2.7.15-ghost:src/platform/esp32/architecture.h:171, darkmesh-firmware-2.7.21-ghost:src/platform/esp32/architecture.h:166 | https://www.radiomasterrc.com/products/bandit-expresslrs-rf-module |
| RADIOMASTER_900_BANDIT_NANO | 64 | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | darkmesh-firmware-2.7.15-ghost:src/platform/esp32/architecture.h:169, darkmesh-firmware-2.7.21-ghost:src/platform/esp32/architecture.h:164 | https://www.radiomasterrc.com/products/bandit-nano-expresslrs-rf-module |
| RAK11200 | 13 | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | darkmesh-firmware-2.7.15-ghost:src/platform/esp32/architecture.h:74, darkmesh-firmware-2.7.21-ghost:src/platform/esp32/architecture.h:71 | https://docs.rakwireless.com/Product-Categories/WisBlock/RAK11200/Overview/ |
| RAK3172 | 72 | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | darkmesh-firmware-2.7.15-ghost:src/platform/stm32wl/architecture.h:25, darkmesh-firmware-2.7.21-ghost:src/platform/stm32wl/architecture.h:25 | https://store.rakwireless.com/products/wisduo-lpwan-module-rak3172 |
| RAK3312 | 106 | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | darkmesh-firmware-2.7.15-ghost:src/platform/esp32/architecture.h:193, darkmesh-firmware-2.7.21-ghost:src/platform/esp32/architecture.h:188 | https://docs.rakwireless.com/product-categories/wisduo/rak3112-module/overview/ |
| RAK3401 | 117 | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | darkmesh-firmware-2.7.15-ghost:src/platform/nrf52/architecture.h:64, darkmesh-firmware-2.7.21-ghost:src/platform/nrf52/architecture.h:80 | rakwireless.com |
| RP2040_FEATHER_RFM95 | 76 | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | darkmesh-firmware-2.7.15-ghost:src/platform/rp2xx0/architecture.h:35, darkmesh-firmware-2.7.21-ghost:src/platform/rp2xx0/architecture.h:35 | https://www.adafruit.com/product/5714, https://www.adafruit.com/product/326, https://www.adafruit.com/product/938 |
| RP2040_LORA | 30 | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | darkmesh-firmware-2.7.15-ghost:src/platform/rp2xx0/architecture.h:33, darkmesh-firmware-2.7.21-ghost:src/platform/rp2xx0/architecture.h:33 | https://www.waveshare.com/rp2040-lora.htm |
| SEEED_SOLAR_NODE | 95 | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | darkmesh-firmware-2.7.15-ghost:src/platform/nrf52/architecture.h:98, darkmesh-firmware-2.7.21-ghost:src/platform/nrf52/architecture.h:125 | seeedstudio.com |
| SENSELORA_RP2040 | 27 | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | darkmesh-firmware-2.7.15-ghost:src/platform/rp2xx0/architecture.h:31, darkmesh-firmware-2.7.21-ghost:src/platform/rp2xx0/architecture.h:31 | makerfabs.com |
| SENSELORA_S3 | 28 | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | darkmesh-firmware-2.7.15-ghost:src/platform/esp32/architecture.h:157, darkmesh-firmware-2.7.21-ghost:src/platform/esp32/architecture.h:152 | makerfabs.com |
| STATION_G1 | 25 | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | darkmesh-firmware-2.7.15-ghost:src/platform/esp32/architecture.h:113, darkmesh-firmware-2.7.21-ghost:src/platform/esp32/architecture.h:108 | https://uniteng.com/wiki/doku.php?id=meshtastic:station |
| STATION_G3 | 134 | meshtastic-firmware-master | meshtastic-firmware-master:src/platform/esp32/architecture.h:162, meshtastic-firmware-master:variants/esp32s3/station-g3/platformio.ini:3 | uniteng.com |
| THINKNODE_M1 | 89 | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | darkmesh-firmware-2.7.15-ghost:src/platform/nrf52/architecture.h:70, darkmesh-firmware-2.7.21-ghost:src/platform/nrf52/architecture.h:91 | https://www.elecrow.com/wiki/ThinkNode-M1_Transceiver_Device(Meshtastic, https://www.elecrow.com/wiki/ThinkNode-M2_Transceiver_Device(Meshtastic |
| THINKNODE_M2 | 90 | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | darkmesh-firmware-2.7.15-ghost:src/platform/esp32/architecture.h:151, darkmesh-firmware-2.7.21-ghost:src/platform/esp32/architecture.h:146 | elecrow.com |
| THINKNODE_M3 | 115 | darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | darkmesh-firmware-2.7.21-ghost:src/platform/nrf52/architecture.h:93, darkmesh-firmware-2.7.21-ghost:variants/nrf52840/ELECROW-ThinkNode-M3/platformio.ini:11 | elecrow.com |
| THINKNODE_M4 | 119 | darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | darkmesh-firmware-2.7.21-ghost:src/platform/nrf52/architecture.h:97, meshtastic-firmware-master:src/platform/nrf52/architecture.h:101 | elecrow.com |
| THINKNODE_M5 | 107 | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | darkmesh-firmware-2.7.15-ghost:src/platform/esp32/architecture.h:153, darkmesh-firmware-2.7.21-ghost:src/platform/esp32/architecture.h:148 | https://www.elecrow.com/wiki/ThinkNode_M5_Meshtastic_LoRa_Signal_Transceiver_ESP32-S3.html |
| THINKNODE_M6 | 120 | darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | darkmesh-firmware-2.7.21-ghost:src/platform/nrf52/architecture.h:95, darkmesh-firmware-2.7.21-ghost:variants/nrf52840/ELECROW-ThinkNode-M6/platformio.ini:4 | elecrow.com |
| THINKNODE_M7 | 129 | meshtastic-firmware-master | meshtastic-firmware-master:src/platform/esp32/architecture.h:150 | elecrow.com |
| TLORA_V1 | 2 | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | darkmesh-firmware-2.7.15-ghost:src/platform/esp32/architecture.h:87, darkmesh-firmware-2.7.21-ghost:src/platform/esp32/architecture.h:84 | lilygo.cc |
| TLORA_V1_1P3 | 8 | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | darkmesh-firmware-2.7.15-ghost:src/platform/esp32/architecture.h:91, darkmesh-firmware-2.7.21-ghost:src/platform/esp32/architecture.h:88 | lilygo.cc |
| TWC_MESH_V4 | 62 | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | darkmesh-firmware-2.7.15-ghost:src/platform/nrf52/architecture.h:78, darkmesh-firmware-2.7.21-ghost:src/platform/nrf52/architecture.h:105 | - |
| T_ETH_ELITE | 91 | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | darkmesh-firmware-2.7.15-ghost:src/platform/esp32/architecture.h:187, darkmesh-firmware-2.7.21-ghost:src/platform/esp32/architecture.h:182 | - |
| T_IMPULSE_PLUS | 135 | meshtastic-firmware-master | meshtastic-firmware-master:src/platform/nrf52/architecture.h:93, meshtastic-firmware-master:variants/nrf52840/t-impulse-plus/platformio.ini:3 | - |
| T_LORA_PAGER | 103 | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | darkmesh-firmware-2.7.15-ghost:src/platform/esp32/architecture.h:201, darkmesh-firmware-2.7.21-ghost:src/platform/esp32/architecture.h:198 | lilygo.cc |
| UNPHONE | 59 | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | darkmesh-firmware-2.7.15-ghost:src/platform/esp32/architecture.h:165, darkmesh-firmware-2.7.21-ghost:src/platform/esp32/architecture.h:160 | unphone.net |
| WIO_E5 | 73 | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | darkmesh-firmware-2.7.15-ghost:src/platform/stm32wl/architecture.h:23, darkmesh-firmware-2.7.21-ghost:src/platform/stm32wl/architecture.h:23 | seeedstudio.com |
| WIPHONE | 20 | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | darkmesh-firmware-2.7.15-ghost:src/platform/esp32/architecture.h:167, darkmesh-firmware-2.7.21-ghost:src/platform/esp32/architecture.h:162 | https://www.wiphone.io/ |
| WISMESH_TAG | 105 | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | darkmesh-firmware-2.7.15-ghost:src/platform/nrf52/architecture.h:53, darkmesh-firmware-2.7.21-ghost:src/platform/nrf52/architecture.h:72 | rakwireless.com |
| XIAO_NRF52_KIT | 88 | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | darkmesh-firmware-2.7.15-ghost:src/platform/nrf52/architecture.h:96, darkmesh-firmware-2.7.21-ghost:src/platform/nrf52/architecture.h:123 | seeedstudio.com |

## Firmware/Local Protobuf Wire Compatibility

Firmware hardware declarations missing from that source's generated HardwareModel enum:

| HardwareModel | Missing in source enum | Declared by sources |
| --- | --- | --- |
| GAT562_MESH_TRIAL_TRACKER | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master |
| NRF52840DK | darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master |

Firmware wire numbers resolve to different names in the local protobuf enum:

| Firmware HardwareModel | Number | Local protobuf name | Firmware sources |
| --- | --- | --- | --- |
| NRF52840DK | 33 | T_ECHO_PLUS | darkmesh-firmware-2.7.15-ghost |

## Firmware Image Metadata Gaps

| HardwareModel | Number | Firmware image files | DeviceImage file | Missing local image files | Firmware sources | Source reference |
| --- | --- | --- | --- | --- | --- | --- |
| RAK11200 | 13 | rak11200.svg | - | rak11200.svg | darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | darkmesh-firmware-2.7.21-ghost:variants/esp32/rak11200/platformio.ini:8, meshtastic-firmware-master:variants/esp32/rak11200/platformio.ini:8 |
| T_ECHO_PLUS | 33 | t-echo_plus.svg | t-echo.svg | t-echo_plus.svg | meshtastic-firmware-master | meshtastic-firmware-master:variants/nrf52840/t-echo-plus/platformio.ini:8 |
| HELTEC_WIRELESS_PAPER_V1_0 | 57 | heltec-wireless-paper-v1_0.svg | heltec-wireless-paper-V1_0.svg | heltec-wireless-paper-v1_0.svg | darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | darkmesh-firmware-2.7.21-ghost:variants/esp32s3/heltec_wireless_paper_v1/platformio.ini:8, meshtastic-firmware-master:variants/esp32s3/heltec_wireless_paper_v1/platformio.ini:8 |
| HELTEC_WIRELESS_TRACKER_V1_0 | 58 | heltec-wireless-tracker.svg | heltec-wireless-tracker-V1-0.svg | - | darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | darkmesh-firmware-2.7.21-ghost:variants/esp32s3/heltec_wireless_tracker_V1_0/platformio.ini:8, meshtastic-firmware-master:variants/esp32s3/heltec_wireless_tracker_V1_0/platformio.ini:8 |
| XIAO_NRF52_KIT | 88 | seeed_xiao_nrf52_kit.svg | - | seeed_xiao_nrf52_kit.svg | darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | darkmesh-firmware-2.7.21-ghost:variants/nrf52840/seeed_xiao_nrf52840_kit/platformio.ini:9, meshtastic-firmware-master:variants/nrf52840/seeed_xiao_nrf52840_kit/platformio.ini:9 |
| THINKNODE_M1 | 89 | thinknode_m1.svg | - | thinknode_m1.svg | darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | darkmesh-firmware-2.7.21-ghost:variants/nrf52840/ELECROW-ThinkNode-M1/platformio.ini:9, meshtastic-firmware-master:variants/nrf52840/ELECROW-ThinkNode-M1/platformio.ini:9 |
| THINKNODE_M2 | 90 | thinknode_m2.svg | - | thinknode_m2.svg | darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | darkmesh-firmware-2.7.21-ghost:variants/esp32s3/ELECROW-ThinkNode-M2/platformio.ini:8, meshtastic-firmware-master:variants/esp32s3/ELECROW-ThinkNode-M2/platformio.ini:8 |
| MUZI_BASE | 93 | muzi_base.svg | - | muzi_base.svg | darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | darkmesh-firmware-2.7.21-ghost:variants/nrf52840/muzi_base/platformio.ini:8, meshtastic-firmware-master:variants/nrf52840/muzi_base/platformio.ini:8 |
| HELTEC_MESH_POCKET | 94 | heltec_mesh_pocket.svg | - | heltec_mesh_pocket.svg | darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | darkmesh-firmware-2.7.21-ghost:variants/nrf52840/heltec_mesh_pocket/platformio.ini:4, darkmesh-firmware-2.7.21-ghost:variants/nrf52840/heltec_mesh_pocket/platformio.ini:68, meshtastic-firmware-master:variants/nrf52840/heltec_mesh_pocket/platformio.ini:4 |
| SEEED_SOLAR_NODE | 95 | seeed_solar.svg | - | seeed_solar.svg | darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | darkmesh-firmware-2.7.21-ghost:variants/nrf52840/seeed_solar_node/platformio.ini:8, meshtastic-firmware-master:variants/nrf52840/seeed_solar_node/platformio.ini:8 |
| NOMADSTAR_METEOR_PRO | 96 | meteor_pro.svg | - | meteor_pro.svg | darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | darkmesh-firmware-2.7.21-ghost:variants/nrf52840/rak4631_nomadstar_meteor_pro/platformio.ini:9, meshtastic-firmware-master:variants/nrf52840/rak4631_nomadstar_meteor_pro/platformio.ini:9 |
| CROWPANEL | 97 | crowpanel_2_4.svg, crowpanel_2_8.svg, crowpanel_3_5.svg, crowpanel_5_0.svg, crowpanel_7_0.svg | - | crowpanel_2_4.svg, crowpanel_2_8.svg, crowpanel_3_5.svg, crowpanel_5_0.svg, crowpanel_7_0.svg | darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | darkmesh-firmware-2.7.21-ghost:variants/esp32s3/elecrow_panel/platformio.ini:83, darkmesh-firmware-2.7.21-ghost:variants/esp32s3/elecrow_panel/platformio.ini:118, darkmesh-firmware-2.7.21-ghost:variants/esp32s3/elecrow_panel/platformio.ini:157 |
| SEEED_WIO_TRACKER_L1 | 99 | wio_tracker_l1_case.svg | wio-tracker-wm1110.svg | wio_tracker_l1_case.svg | darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | darkmesh-firmware-2.7.21-ghost:variants/nrf52840/seeed_wio_tracker_L1/platformio.ini:8, meshtastic-firmware-master:variants/nrf52840/seeed_wio_tracker_L1/platformio.ini:8 |
| SEEED_WIO_TRACKER_L1_EINK | 100 | wio_tracker_l1_eink.svg | wio-tracker-wm1110.svg | wio_tracker_l1_eink.svg | darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | darkmesh-firmware-2.7.21-ghost:variants/nrf52840/seeed_wio_tracker_L1_eink/platformio.ini:8, meshtastic-firmware-master:variants/nrf52840/seeed_wio_tracker_L1_eink/platformio.ini:8 |
| MUZI_R1_NEO | 101 | muzi_r1_neo.svg | - | muzi_r1_neo.svg | darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | darkmesh-firmware-2.7.21-ghost:variants/nrf52840/r1-neo/platformio.ini:9, meshtastic-firmware-master:variants/nrf52840/r1-neo/platformio.ini:9 |
| T_DECK_PRO | 102 | tdeck_pro.svg | t-deck.svg | tdeck_pro.svg | darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | darkmesh-firmware-2.7.21-ghost:variants/esp32s3/t-deck-pro/platformio.ini:8, meshtastic-firmware-master:variants/esp32s3/t-deck-pro-v1_1/platformio.ini:8, meshtastic-firmware-master:variants/esp32s3/t-deck-pro/platformio.ini:8 |
| T_LORA_PAGER | 103 | lilygo-tlora-pager.svg | - | lilygo-tlora-pager.svg | darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | darkmesh-firmware-2.7.21-ghost:variants/esp32s3/tlora-pager/platformio.ini:9, meshtastic-firmware-master:variants/esp32s3/tlora-pager/platformio.ini:9 |
| WISMESH_TAG | 105 | rak_wismesh_tag.svg | - | rak_wismesh_tag.svg | darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | darkmesh-firmware-2.7.21-ghost:variants/nrf52840/rak_wismeshtag/platformio.ini:4, meshtastic-firmware-master:variants/nrf52840/rak_wismeshtag/platformio.ini:4 |
| RAK3312 | 106 | rak_3312.svg | - | rak_3312.svg | darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | darkmesh-firmware-2.7.21-ghost:variants/esp32s3/rak3312/platformio.ini:8, meshtastic-firmware-master:variants/esp32s3/rak3312/platformio.ini:8 |
| THINKNODE_M5 | 107 | thinknode_m1.svg | - | thinknode_m1.svg | darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | darkmesh-firmware-2.7.21-ghost:variants/esp32s3/ELECROW-ThinkNode-M5/platformio.ini:8, meshtastic-firmware-master:variants/esp32s3/ELECROW-ThinkNode-M5/platformio.ini:8 |
| HELTEC_MESH_SOLAR | 108 | heltec-mesh-solar.svg | - | heltec-mesh-solar.svg | darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | darkmesh-firmware-2.7.21-ghost:variants/nrf52840/heltec_mesh_solar/platformio.ini:28, meshtastic-firmware-master:variants/nrf52840/heltec_mesh_solar/platformio.ini:28 |
| T_ECHO_LITE | 109 | techo_lite.svg | t-echo.svg | techo_lite.svg | darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | darkmesh-firmware-2.7.21-ghost:variants/nrf52840/t-echo-lite/platformio.ini:9, meshtastic-firmware-master:variants/nrf52840/t-echo-lite/platformio.ini:9 |
| HELTEC_V4 | 110 | heltec_v4.svg | heltec-v4.svg | heltec_v4.svg | darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | darkmesh-firmware-2.7.21-ghost:variants/esp32s3/heltec_v4/platformio.ini:21, darkmesh-firmware-2.7.21-ghost:variants/esp32s3/heltec_v4/platformio.ini:45, meshtastic-firmware-master:variants/esp32s3/heltec_v4/platformio.ini:20 |
| M5STACK_C6L | 111 | m5_c6l.svg | - | m5_c6l.svg | darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | darkmesh-firmware-2.7.21-ghost:variants/esp32c6/m5stack_unitc6l/platformio.ini:8, meshtastic-firmware-master:variants/esp32c6/m5stack_unitc6l/platformio.ini:8 |
| HELTEC_WIRELESS_TRACKER_V2 | 113 | heltec_wireless_tracker_v2.svg | heltec-wireless-tracker.svg | heltec_wireless_tracker_v2.svg | darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | darkmesh-firmware-2.7.21-ghost:variants/esp32s3/heltec_wireless_tracker_v2/platformio.ini:3, meshtastic-firmware-master:variants/esp32s3/heltec_wireless_tracker_v2/platformio.ini:3 |
| THINKNODE_M3 | 115 | thinknode_m3.svg | - | thinknode_m3.svg | darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | darkmesh-firmware-2.7.21-ghost:variants/nrf52840/ELECROW-ThinkNode-M3/platformio.ini:3, meshtastic-firmware-master:variants/nrf52840/ELECROW-ThinkNode-M3/platformio.ini:3 |
| WISMESH_TAP_V2 | 116 | rak-wismesh-tap-v2.svg | rak-wismeshtap.svg | rak-wismesh-tap-v2.svg | darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | darkmesh-firmware-2.7.21-ghost:variants/esp32s3/rak_wismesh_tap_v2/platformio.ini:20, meshtastic-firmware-master:variants/esp32s3/rak_wismesh_tap_v2/platformio.ini:20 |
| RAK3401 | 117 | rak3401.svg | - | rak3401.svg | darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | darkmesh-firmware-2.7.21-ghost:variants/nrf52840/rak3401_1watt/platformio.ini:9, meshtastic-firmware-master:variants/nrf52840/rak3401_1watt/platformio.ini:9 |
| THINKNODE_M6 | 120 | thinknode_m6.svg | - | thinknode_m6.svg | darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | darkmesh-firmware-2.7.21-ghost:variants/nrf52840/ELECROW-ThinkNode-M6/platformio.ini:9, meshtastic-firmware-master:variants/nrf52840/ELECROW-ThinkNode-M6/platformio.ini:9 |
| TBEAM_1_WATT | 122 | tbeam-1w.svg | tbeam.svg | tbeam-1w.svg | darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | darkmesh-firmware-2.7.21-ghost:variants/esp32s3/t-beam-1w/platformio.ini:9, meshtastic-firmware-master:variants/esp32s3/t-beam-1w/platformio.ini:9 |
| MINI_EPAPER_S3 | 125 | mini-epaper-s3.svg | - | mini-epaper-s3.svg | darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | darkmesh-firmware-2.7.21-ghost:variants/esp32s3/mini-epaper-s3/platformio.ini:8, meshtastic-firmware-master:variants/esp32s3/mini-epaper-s3/platformio.ini:8 |
| HELTEC_MESH_NODE_T096 | 127 | heltec-mesh-node-t096-case.svg, heltec-mesh-node-t096.svg | - | heltec-mesh-node-t096-case.svg, heltec-mesh-node-t096.svg | darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | darkmesh-firmware-2.7.21-ghost:variants/nrf52840/heltec_mesh_node_t096/platformio.ini:9, meshtastic-firmware-master:variants/nrf52840/heltec_mesh_node_t096/platformio.ini:9 |
| HELTEC_V4_R8 | 132 | heltec_v4_r8.svg, heltec_v4_r8_tft.svg | heltec-v4.svg | heltec_v4_r8.svg, heltec_v4_r8_tft.svg | meshtastic-firmware-master | meshtastic-firmware-master:variants/esp32s3/heltec_v4_r8/platformio.ini:21, meshtastic-firmware-master:variants/esp32s3/heltec_v4_r8/platformio.ini:43 |
| HELTEC_MESH_NODE_T1 | 133 | heltec-mesh-node-t1.svg | - | heltec-mesh-node-t1.svg | meshtastic-firmware-master | meshtastic-firmware-master:variants/nrf52840/heltec_mesh_node_t1/platformio.ini:9 |
| STATION_G3 | 134 | station-g3.svg | - | station-g3.svg | meshtastic-firmware-master | meshtastic-firmware-master:variants/esp32s3/station-g3/platformio.ini:8 |

## Mappings With Missing Asset Files

Every DeviceImage mapping points to an existing file.

## Research Queue

For each missing model, prefer an official producer image with a front/top board view. Use SVG when available; otherwise choose a suitable official raster image for later conversion.

| HardwareModel | Producer/source hint | Target asset note |
| --- | --- | --- |
| BETAFPV_2400_TX | betafpv.com | betafpv-2400-tx.svg candidate |
| BETAFPV_900_NANO_TX | betafpv.com | betafpv-900-nano-tx.svg candidate |
| CANARYONE | https://canaryradio.io/products/canaryone | canaryone.svg candidate |
| CDEBYTE_EORA_S3 | - | cdebyte-eora-s3.svg candidate |
| CHATTER_2 | - | chatter-2.svg candidate |
| CROWPANEL | elecrow.com | crowpanel.svg candidate |
| DR_DEV | https://github.com/sudomesh/disaster-radio/tree/master/hardware/board_esp32_v3 | dr-dev.svg candidate |
| EBYTE_ESP32_S3 | - | ebyte-esp32-s3.svg candidate |
| ESP32_S3_PICO | waveshare.com | esp32-s3-pico.svg candidate |
| GAT562_MESH_TRIAL_TRACKER | - | gat562-mesh-trial-tracker.svg candidate |
| GENIEBLOCKS | - | genieblocks.svg candidate |
| HELTEC_CAPSULE_SENSOR_V3 | heltec.org | heltec-capsule-sensor-v3.svg candidate |
| HELTEC_HRU_3601 | https://heltec.org/project/hru-3601/ | heltec-hru-3601.svg candidate |
| HELTEC_MESH_NODE_T096 | heltec.org | heltec-mesh-node-t096.svg candidate |
| HELTEC_MESH_NODE_T1 | heltec.org | heltec-mesh-node-t1.svg candidate |
| HELTEC_MESH_POCKET | heltec.org | heltec-mesh-pocket.svg candidate |
| HELTEC_MESH_SOLAR | https://heltec.org/project/meshsolar/ | heltec-mesh-solar.svg candidate |
| HELTEC_SENSOR_HUB | heltec.org | heltec-sensor-hub.svg candidate |
| HELTEC_V1 | heltec.org | heltec-v1.svg candidate |
| HELTEC_WIRELESS_BRIDGE | heltec.org | heltec-wireless-bridge.svg candidate |
| LINK_32 | - | link-32.svg candidate |
| M5STACK | https://m5stack.com/ | m5stack.svg candidate |
| M5STACK_C6L | m5stack.com | m5stack-c6l.svg candidate |
| M5STACK_CARDPUTER_ADV | m5stack.com | m5stack-cardputer-adv.svg candidate |
| M5STACK_CORES3 | https://m5stack.com/ | m5stack-cores3.svg candidate |
| ME25LS01_4Y10TD | minewsemi.com | me25ls01-4y10td.svg candidate |
| MESHLINK | https://www.loraitalia.it | meshlink.svg candidate |
| MESH_TAB | https://github.com/valzzu/Mesh-Tab | mesh-tab.svg candidate |
| MINI_EPAPER_S3 | - | mini-epaper-s3.svg candidate |
| MS24SF1 | minewsemi.com | ms24sf1.svg candidate |
| MUZI_BASE | - | muzi-base.svg candidate |
| MUZI_R1_NEO | - | muzi-r1-neo.svg candidate |
| NANO_G1 | https://uniteng.com/wiki/doku.php?id=meshtastic:nano | nano-g1.svg candidate |
| NANO_G1_EXPLORER | https://wiki.uniteng.com/en/meshtastic/nano-g1-explorer | nano-g1-explorer.svg candidate |
| NOMADSTAR_METEOR_PRO | https://nomadstar.ch/ | nomadstar-meteor-pro.svg candidate |
| NRF52840DK | - | nrf52840dk.svg candidate |
| NRF52840_PCA10059 | https://www.nordicsemi.com/Products/Development-hardware/nrf52840-dongle/ | nrf52840-pca10059.svg candidate |
| PICOMPUTER_S3 | - | picomputer-s3.svg candidate |
| PPR | - | ppr.svg candidate |
| RADIOMASTER_900_BANDIT | https://www.radiomasterrc.com/products/bandit-expresslrs-rf-module | radiomaster-900-bandit.svg candidate |
| RADIOMASTER_900_BANDIT_NANO | https://www.radiomasterrc.com/products/bandit-nano-expresslrs-rf-module | radiomaster-900-bandit-nano.svg candidate |
| RAK11200 | https://docs.rakwireless.com/Product-Categories/WisBlock/RAK11200/Overview/ | rak11200.svg candidate |
| RAK3172 | https://store.rakwireless.com/products/wisduo-lpwan-module-rak3172 | rak3172.svg candidate |
| RAK3312 | https://docs.rakwireless.com/product-categories/wisduo/rak3112-module/overview/ | rak3312.svg candidate |
| RAK3401 | rakwireless.com | rak3401.svg candidate |
| RP2040_FEATHER_RFM95 | https://www.adafruit.com/product/5714, https://www.adafruit.com/product/326, https://www.adafruit.com/product/938 | rp2040-feather-rfm95.svg candidate |
| RP2040_LORA | https://www.waveshare.com/rp2040-lora.htm | rp2040-lora.svg candidate |
| SEEED_SOLAR_NODE | seeedstudio.com | seeed-solar-node.svg candidate |
| SENSELORA_RP2040 | makerfabs.com | senselora-rp2040.svg candidate |
| SENSELORA_S3 | makerfabs.com | senselora-s3.svg candidate |
| STATION_G1 | https://uniteng.com/wiki/doku.php?id=meshtastic:station | station-g1.svg candidate |
| STATION_G3 | uniteng.com | station-g3.svg candidate |
| THINKNODE_M1 | https://www.elecrow.com/wiki/ThinkNode-M1_Transceiver_Device(Meshtastic, https://www.elecrow.com/wiki/ThinkNode-M2_Transceiver_Device(Meshtastic | thinknode-m1.svg candidate |
| THINKNODE_M2 | elecrow.com | thinknode-m2.svg candidate |
| THINKNODE_M3 | elecrow.com | thinknode-m3.svg candidate |
| THINKNODE_M4 | elecrow.com | thinknode-m4.svg candidate |
| THINKNODE_M5 | https://www.elecrow.com/wiki/ThinkNode_M5_Meshtastic_LoRa_Signal_Transceiver_ESP32-S3.html | thinknode-m5.svg candidate |
| THINKNODE_M6 | elecrow.com | thinknode-m6.svg candidate |
| THINKNODE_M7 | elecrow.com | thinknode-m7.svg candidate |
| TLORA_V1 | lilygo.cc | tlora-v1.svg candidate |
| TLORA_V1_1P3 | lilygo.cc | tlora-v1-1p3.svg candidate |
| TWC_MESH_V4 | - | twc-mesh-v4.svg candidate |
| T_ETH_ELITE | - | t-eth-elite.svg candidate |
| T_IMPULSE_PLUS | - | t-impulse-plus.svg candidate |
| T_LORA_PAGER | lilygo.cc | t-lora-pager.svg candidate |
| UNPHONE | unphone.net | unphone.svg candidate |
| WIO_E5 | seeedstudio.com | wio-e5.svg candidate |
| WIPHONE | https://www.wiphone.io/ | wiphone.svg candidate |
| WISMESH_TAG | rakwireless.com | wismesh-tag.svg candidate |
| XIAO_NRF52_KIT | seeedstudio.com | xiao-nrf52-kit.svg candidate |

## Local Protobuf Models Without DeviceImage Mapping

| HardwareModel | Number | Firmware sources | Producer/source hint |
| --- | --- | --- | --- |
| TLORA_V1 | 2 | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | lilygo.cc |
| TLORA_V1_1P3 | 8 | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | lilygo.cc |
| HELTEC_V1 | 11 | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | heltec.org |
| RAK11200 | 13 | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | https://docs.rakwireless.com/Product-Categories/WisBlock/RAK11200/Overview/ |
| NANO_G1 | 14 | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | https://uniteng.com/wiki/doku.php?id=meshtastic:nano |
| NANO_G1_EXPLORER | 17 | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | https://wiki.uniteng.com/en/meshtastic/nano-g1-explorer |
| LORA_TYPE | 19 | - | https://loratype.org/ |
| WIPHONE | 20 | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | https://www.wiphone.io/ |
| HELTEC_HRU_3601 | 23 | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | https://heltec.org/project/hru-3601/ |
| HELTEC_WIRELESS_BRIDGE | 24 | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | heltec.org |
| STATION_G1 | 25 | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | https://uniteng.com/wiki/doku.php?id=meshtastic:station |
| SENSELORA_RP2040 | 27 | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | makerfabs.com |
| SENSELORA_S3 | 28 | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | makerfabs.com |
| CANARYONE | 29 | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | https://canaryradio.io/products/canaryone |
| RP2040_LORA | 30 | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | https://www.waveshare.com/rp2040-lora.htm |
| LORA_RELAY_V1 | 32 | - | - |
| PPR | 34 | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | - |
| GENIEBLOCKS | 35 | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | - |
| NRF52840_PCA10059 | 40 | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | https://www.nordicsemi.com/Products/Development-hardware/nrf52840-dongle/ |
| DR_DEV | 41 | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | https://github.com/sudomesh/disaster-radio/tree/master/hardware/board_esp32_v3 |
| M5STACK | 42 | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | https://m5stack.com/ |
| BETAFPV_2400_TX | 45 | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | betafpv.com |
| BETAFPV_900_NANO_TX | 46 | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | betafpv.com |
| PICOMPUTER_S3 | 52 | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | - |
| EBYTE_ESP32_S3 | 54 | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | - |
| ESP32_S3_PICO | 55 | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | waveshare.com |
| CHATTER_2 | 56 | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | - |
| UNPHONE | 59 | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | unphone.net |
| TD_LORAC | 60 | - | - |
| CDEBYTE_EORA_S3 | 61 | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | - |
| TWC_MESH_V4 | 62 | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | - |
| RADIOMASTER_900_BANDIT_NANO | 64 | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | https://www.radiomasterrc.com/products/bandit-nano-expresslrs-rf-module |
| HELTEC_CAPSULE_SENSOR_V3 | 65 | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | heltec.org |
| RAK3172 | 72 | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | https://store.rakwireless.com/products/wisduo-lpwan-module-rak3172 |
| WIO_E5 | 73 | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | seeedstudio.com |
| RADIOMASTER_900_BANDIT | 74 | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | https://www.radiomasterrc.com/products/bandit-expresslrs-rf-module |
| ME25LS01_4Y10TD | 75 | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | minewsemi.com |
| RP2040_FEATHER_RFM95 | 76 | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | https://www.adafruit.com/product/5714, https://www.adafruit.com/product/326, https://www.adafruit.com/product/938 |
| M5STACK_COREBASIC | 77 | - | https://m5stack.com/ |
| M5STACK_CORE2 | 78 | - | m5stack.com |
| M5STACK_CORES3 | 80 | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | https://m5stack.com/ |
| MS24SF1 | 82 | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | minewsemi.com |
| ROUTASTIC | 85 | - | https://github.com/Jorropo/routastic |
| MESH_TAB | 86 | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | https://github.com/valzzu/Mesh-Tab |
| MESHLINK | 87 | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | https://www.loraitalia.it |
| XIAO_NRF52_KIT | 88 | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | seeedstudio.com |
| THINKNODE_M1 | 89 | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | https://www.elecrow.com/wiki/ThinkNode-M1_Transceiver_Device(Meshtastic, https://www.elecrow.com/wiki/ThinkNode-M2_Transceiver_Device(Meshtastic |
| THINKNODE_M2 | 90 | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | elecrow.com |
| T_ETH_ELITE | 91 | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | - |
| HELTEC_SENSOR_HUB | 92 | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | heltec.org |
| MUZI_BASE | 93 | darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | - |
| HELTEC_MESH_POCKET | 94 | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | heltec.org |
| SEEED_SOLAR_NODE | 95 | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | seeedstudio.com |
| NOMADSTAR_METEOR_PRO | 96 | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | https://nomadstar.ch/ |
| CROWPANEL | 97 | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | elecrow.com |
| LINK_32 | 98 | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | - |
| MUZI_R1_NEO | 101 | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | - |
| T_LORA_PAGER | 103 | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | lilygo.cc |
| M5STACK_RESERVED | 104 | - | m5stack.com |
| WISMESH_TAG | 105 | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | rakwireless.com |
| RAK3312 | 106 | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | https://docs.rakwireless.com/product-categories/wisduo/rak3112-module/overview/ |
| THINKNODE_M5 | 107 | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | https://www.elecrow.com/wiki/ThinkNode_M5_Meshtastic_LoRa_Signal_Transceiver_ESP32-S3.html |
| HELTEC_MESH_SOLAR | 108 | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | https://heltec.org/project/meshsolar/ |
| M5STACK_C6L | 111 | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | m5stack.com |
| M5STACK_CARDPUTER_ADV | 112 | darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | m5stack.com |
| THINKNODE_M3 | 115 | darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | elecrow.com |
| RAK3401 | 117 | darkmesh-firmware-2.7.15-ghost, darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | rakwireless.com |
| RAK6421 | 118 | - | rakwireless.com |
| THINKNODE_M4 | 119 | darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | elecrow.com |
| THINKNODE_M6 | 120 | darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | elecrow.com |
| MESHSTICK_1262 | 121 | - | - |
| T5_S3_EPAPER_PRO | 123 | - | - |
| MINI_EPAPER_S3 | 125 | darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | - |
| TDISPLAY_S3_PRO | 126 | - | - |
| HELTEC_MESH_NODE_T096 | 127 | darkmesh-firmware-2.7.21-ghost, meshtastic-firmware-master | heltec.org |
| THINKNODE_M7 | 129 | meshtastic-firmware-master | elecrow.com |
| THINKNODE_M8 | 130 | - | elecrow.com |
| THINKNODE_M9 | 131 | - | elecrow.com |
| HELTEC_MESH_NODE_T1 | 133 | meshtastic-firmware-master | heltec.org |
| STATION_G3 | 134 | meshtastic-firmware-master | uniteng.com |
| T_IMPULSE_PLUS | 135 | meshtastic-firmware-master | - |
| CROWPANEL_P4 | 138 | - | elecrow.com |
| HELTEC_MESH_TOWER_V2 | 139 | - | heltec.org |
| MESHNOLOGY_W10 | 140 | - | - |

## Approved Generic Fallbacks

- `NRF52_UNKNOWN`
- `PORTDUINO`
- `PRIVATE_HW`

## Mapped Models Not Declared By Inspected Firmware

| HardwareModel | Filename | DeviceImage line |
| --- | --- | --- |
| HELTEC_MESH_NODE_T114_CASE | heltec-mesh-node-t114-case.svg | 19 |
| HELTEC_V3_CASE | heltec-v3-case.svg | 23 |
| PROMICRO | promicro.svg | 64 |
| RAK4631_CASE | rak4631_case.svg | 44 |
| RPIPICOW | rpipicow.svg | 66 |
| SEEED_WIO_TRACKER_L2 | wio-tracker-wm1110.svg | 49 |
| TBEAM_BPF | tbeam.svg | 56 |
| TLORA_T3_S3_EPAPER | tlora-t3s3-epaper.svg | 37 |
| TRACKER_T1000_E_PRO | tracker-t1000-e.svg | 59 |
| T_WATCH_ULTRA | t-watch-s3.svg | 61 |
| WM1110_DEV_KIT | wm1110_dev_kit.svg | 51 |

## Unused Device Asset Files

No extra device asset files are currently unused by DeviceImage.
