import { create, fromBinary } from "@bufbuild/protobuf";
import * as Protobuf from "@meshtastic/protobufs";
import { describe, expect, it } from "vitest";
import { Constants } from "./constants.ts";
import { MeshDevice } from "./meshDevice.ts";
import { ChannelNumber, type PacketMetadata } from "./types.ts";
import { compressTextForMesh } from "./utils/messageCompression.ts";

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

  it("compresses text in app mode and echoes clear text with savings metadata", async () => {
    const writes: Uint8Array[] = [];
    const receivedMessages: PacketMetadata<string>[] = [];
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
    device.events.onMessagePacket.subscribe((packet) => {
      receivedMessages.push(packet);
    });

    const text = "hello hello hello from darkmesh compression compression compression";
    const sendPromise = device.sendText(
      text,
      "broadcast",
      true,
      ChannelNumber.Primary,
      undefined,
      undefined,
      true,
      { mode: "app", spreadingFactor: 9 },
    );

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
    expect(packet.payloadVariant.case).toBe("decoded");
    if (packet.payloadVariant.case !== "decoded") {
      throw new Error("Expected decoded packet");
    }

    expect(packet.payloadVariant.value.portnum).toBe(
      Protobuf.Portnums.PortNum.TEXT_MESSAGE_COMPRESSED_APP,
    );
    expect(packet.payloadVariant.value.payload.length).toBeLessThan(
      new TextEncoder().encode(text).length,
    );
    expect(receivedMessages[0]).toMatchObject({
      data: text,
      compressed: true,
      compressionMode: "app",
    });
    expect(receivedMessages[0]?.savedBytes).toBeGreaterThan(0);
    expect(receivedMessages[0]?.savedAirtimeMs).toBeGreaterThan(0);

    device.queue.processAck(packet.id);
    await expect(sendPromise).resolves.toBe(packet.id);
  });

  it("defaults compressed text sends to app-side compression", async () => {
    const writes: Uint8Array[] = [];
    const receivedMessages: PacketMetadata<string>[] = [];
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
    device.events.onMessagePacket.subscribe((packet) => {
      receivedMessages.push(packet);
    });

    const text = "default default default darkmesh app compression compression";
    const sendPromise = device.sendText(
      text,
      "broadcast",
      true,
      ChannelNumber.Primary,
      undefined,
      undefined,
      true,
    );

    await waitForWrite(writes);
    const firstWrite = writes[0];
    if (!firstWrite) {
      throw new Error("Expected MeshDevice write");
    }

    const toRadio = fromBinary(Protobuf.Mesh.ToRadioSchema, firstWrite);
    if (toRadio.payloadVariant.case !== "packet") {
      throw new Error("Expected packet payload");
    }

    const packet = toRadio.payloadVariant.value;
    if (packet.payloadVariant.case !== "decoded") {
      throw new Error("Expected decoded packet");
    }

    expect(packet.payloadVariant.value.portnum).toBe(
      Protobuf.Portnums.PortNum.TEXT_MESSAGE_COMPRESSED_APP,
    );
    expect(packet.payloadVariant.value.payload.length).toBeLessThan(
      new TextEncoder().encode(text).length,
    );
    expect(receivedMessages[0]).toMatchObject({
      data: text,
      compressed: true,
      compressionMode: "app",
    });

    device.queue.processAck(packet.id);
    await expect(sendPromise).resolves.toBe(packet.id);
  });

  it("keeps legacy firmware compression mode as compressed port with plain text payload", async () => {
    const writes: Uint8Array[] = [];
    const receivedMessages: PacketMetadata<string>[] = [];
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
    device.events.onMessagePacket.subscribe((packet) => {
      receivedMessages.push(packet);
    });

    const text = "legacy remote compression request";
    const sendPromise = device.sendText(
      text,
      "broadcast",
      true,
      ChannelNumber.Primary,
      undefined,
      undefined,
      true,
      { mode: "remote" },
    );

    await waitForWrite(writes);
    const firstWrite = writes[0];
    if (!firstWrite) {
      throw new Error("Expected MeshDevice write");
    }

    const toRadio = fromBinary(Protobuf.Mesh.ToRadioSchema, firstWrite);
    if (toRadio.payloadVariant.case !== "packet") {
      throw new Error("Expected packet payload");
    }

    const packet = toRadio.payloadVariant.value;
    if (packet.payloadVariant.case !== "decoded") {
      throw new Error("Expected decoded packet");
    }

    expect(packet.payloadVariant.value.portnum).toBe(
      Protobuf.Portnums.PortNum.TEXT_MESSAGE_COMPRESSED_APP,
    );
    expect(new TextDecoder().decode(packet.payloadVariant.value.payload)).toBe(text);
    expect(receivedMessages[0]).toMatchObject({
      data: text,
      compressed: true,
      compressionMode: "remote",
    });
    expect(receivedMessages[0]?.savedBytes).toBeUndefined();

    device.queue.processAck(packet.id);
    await expect(sendPromise).resolves.toBe(packet.id);
  });

  it("uses heartbeat nonce 1 for local nodeinfo refresh", async () => {
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

    const requestPromise = device.requestNodeInfo(111);

    await waitForWrite(writes);
    const firstWrite = writes[0];
    if (!firstWrite) {
      throw new Error("Expected MeshDevice write");
    }

    const toRadio = fromBinary(Protobuf.Mesh.ToRadioSchema, firstWrite);
    expect(toRadio.payloadVariant.case).toBe("heartbeat");
    if (toRadio.payloadVariant.case !== "heartbeat") {
      throw new Error("Expected heartbeat payload");
    }

    expect(toRadio.payloadVariant.value.nonce).toBe(1);

    const queuedId = device.queue.getState()[0]?.id;
    if (queuedId === undefined) {
      throw new Error("Expected queued heartbeat");
    }
    device.queue.processAck(queuedId);
    await expect(requestPromise).resolves.toBe(queuedId);
  });

  it("keeps remote nodeinfo requests on the NODEINFO_APP port", async () => {
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

    const requestPromise = device.requestNodeInfo(222);

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
    expect(packet.to).toBe(222);
    expect(packet.wantAck).toBe(false);
    expect(packet.payloadVariant.case).toBe("decoded");
    if (packet.payloadVariant.case !== "decoded") {
      throw new Error("Expected decoded packet");
    }
    expect(packet.payloadVariant.value.portnum).toBe(Protobuf.Portnums.PortNum.NODEINFO_APP);

    device.queue.processAck(packet.id);
    await expect(requestPromise).resolves.toBe(packet.id);
  });

  it("requests device UI config with the dedicated admin command", async () => {
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

    const requestPromise = device.getDeviceUiConfig();

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
    expect(packet.payloadVariant.case).toBe("decoded");
    if (packet.payloadVariant.case !== "decoded") {
      throw new Error("Expected decoded packet");
    }

    const data = packet.payloadVariant.value;
    expect(data.portnum).toBe(Protobuf.Portnums.PortNum.ADMIN_APP);
    const adminMessage = fromBinary(Protobuf.Admin.AdminMessageSchema, data.payload);
    expect(adminMessage.payloadVariant.case).toBe("getUiConfigRequest");
    expect(data.wantResponse).toBe(true);

    device.queue.processAck(packet.id);
    await expect(requestPromise).resolves.toBe(packet.id);
  });

  it("decompresses incoming app-compressed text packets", () => {
    const receivedMessages: PacketMetadata<string>[] = [];
    const device = new MeshDevice({
      toDevice: new WritableStream<Uint8Array>(),
      fromDevice: new ReadableStream({ start: (controller) => controller.close() }),
      disconnect: () => Promise.resolve(),
    });
    const text = "incoming incoming incoming compressed darkmesh payload";
    const compressed = compressTextForMesh(text);
    if (!compressed) {
      throw new Error("Expected compressible test message");
    }

    device.events.onMyNodeInfo.dispatch({
      myNodeNum: 111,
    } as Protobuf.Mesh.MyNodeInfo);
    device.events.onMessagePacket.subscribe((packet) => {
      receivedMessages.push(packet);
    });

    device.handleMeshPacket(
      create(Protobuf.Mesh.MeshPacketSchema, {
        payloadVariant: {
          case: "decoded",
          value: {
            portnum: Protobuf.Portnums.PortNum.TEXT_MESSAGE_COMPRESSED_APP,
            payload: compressed.payload,
          },
        },
        from: 222,
        to: 111,
        id: 123,
        channel: ChannelNumber.Primary,
      }),
    );

    expect(receivedMessages[0]).toMatchObject({
      data: text,
      compressed: true,
      from: 222,
      to: 111,
    });
  });

  it("decompresses app-compressed text packets with non-canonical padding bits", () => {
    const receivedMessages: PacketMetadata<string>[] = [];
    const device = new MeshDevice({
      toDevice: new WritableStream<Uint8Array>(),
      fromDevice: new ReadableStream({ start: (controller) => controller.close() }),
      disconnect: () => Promise.resolve(),
    });
    const text = "incoming incoming incoming compressed darkmesh payload";
    const compressed = compressTextForMesh(text);
    if (!compressed) {
      throw new Error("Expected compressible test message");
    }
    const payload = new Uint8Array(compressed.payload);
    payload[payload.length - 1] ^= 1;

    device.events.onMyNodeInfo.dispatch({
      myNodeNum: 111,
    } as Protobuf.Mesh.MyNodeInfo);
    device.events.onMessagePacket.subscribe((packet) => {
      receivedMessages.push(packet);
    });

    device.handleMeshPacket(
      create(Protobuf.Mesh.MeshPacketSchema, {
        payloadVariant: {
          case: "decoded",
          value: {
            portnum: Protobuf.Portnums.PortNum.TEXT_MESSAGE_COMPRESSED_APP,
            payload,
          },
        },
        from: 222,
        to: 111,
        id: 124,
        channel: ChannelNumber.Primary,
      }),
    );

    expect(receivedMessages[0]).toMatchObject({
      data: text,
      compressed: true,
      from: 222,
      to: 111,
    });
  });

  it("keeps legacy plain text payloads on the compressed port readable", () => {
    const receivedMessages: PacketMetadata<string>[] = [];
    const device = new MeshDevice({
      toDevice: new WritableStream<Uint8Array>(),
      fromDevice: new ReadableStream({ start: (controller) => controller.close() }),
      disconnect: () => Promise.resolve(),
    });
    const text = "legacy remote compression request";

    device.events.onMyNodeInfo.dispatch({
      myNodeNum: 111,
    } as Protobuf.Mesh.MyNodeInfo);
    device.events.onMessagePacket.subscribe((packet) => {
      receivedMessages.push(packet);
    });

    device.handleMeshPacket(
      create(Protobuf.Mesh.MeshPacketSchema, {
        payloadVariant: {
          case: "decoded",
          value: {
            portnum: Protobuf.Portnums.PortNum.TEXT_MESSAGE_COMPRESSED_APP,
            payload: new TextEncoder().encode(text),
          },
        },
        from: 222,
        to: 111,
        id: 125,
        channel: ChannelNumber.Primary,
      }),
    );

    expect(receivedMessages[0]).toMatchObject({
      data: text,
      compressed: true,
      from: 222,
      to: 111,
    });
  });
});
