import type { Protobuf } from "@meshtastic/core";

declare module "@meshtastic/core" {
  // augment Mesh.NodeInfo to include rxRssi observed by gateway/packets
  namespace Protobuf {
    namespace Mesh {
      interface NodeInfo {
        rxRssi?: number;
      }
    }
  }
}
