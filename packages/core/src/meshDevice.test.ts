import { fromBinary } from "@bufbuild/protobuf";
import * as Protobuf from "@meshtastic/protobufs";
import { describe, expect, it } from "vitest";
import { Constants } from "./constants.ts";
import { MeshDevice } from "./meshDevice.ts";
import { ChannelNumber } from "./types.ts";

async function waitForWrite(writes: Uint8Array[]) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (writes.length > 0) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error("Timed out waiting for MeshDevice write");
}

describe("MeshDevice message sending", () => {
  it("keeps wantAck on broadcast text sends to match DarkMesh Android", async () => {
    const writes: Uint8Array[] = [];
    const device = new MeshDevice({
      toDevice: new WritableStream<Uint8Array>({
        write(chunk) {
          writes.push(chunk);
        },
      }),
      fromDevice: new ReadableStream({ start: (controller) => controller.close() }),
      disconnect: () => Promise.resolve(),
    });

    device.events.onMyNodeInfo.dispatch({
      myNodeNum: 111,
    } as Protobuf.Mesh.MyNodeInfo);

    const sendPromise = device.sendText("hello channel", "broadcast", true, ChannelNumber.Primary);

    await waitForWrite(writes);
    const firstWrite = writes[0];
    if (!firstWrite) {
      throw new Error("Expected MeshDevice write");
    }

    const toRadio = fromBinary(Protobuf.Mesh.ToRadioSchema, firstWrite);
    expect(toRadio.payloadVariant.case).toBe("packet");
    if (toRadio.payloadVariant.case !== "packet") {
      throw new Error("Expected packet payload");
    }

    const packet = toRadio.payloadVariant.value;
    expect(packet.to).toBe(Constants.broadcastNum);
    expect(packet.wantAck).toBe(true);

    device.queue.processAck(packet.id);
    await expect(sendPromise).resolves.toBe(packet.id);
  });
});
