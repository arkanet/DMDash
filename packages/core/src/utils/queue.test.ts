import { create, toBinary } from "@bufbuild/protobuf";
import * as Protobuf from "@meshtastic/protobufs";
import { describe, expect, it } from "vitest";
import { getRoutingErrorName, Queue } from "./queue.ts";

function buildToRadioPacket(id: number, wantAck: boolean): Uint8Array {
  const meshPacket = create(Protobuf.Mesh.MeshPacketSchema, {
    id,
    wantAck,
    to: 123,
    payloadVariant: {
      case: "decoded",
      value: {
        portnum: Protobuf.Portnums.PortNum.TEXT_MESSAGE_APP,
        payload: new TextEncoder().encode("test"),
      },
    },
  });

  return toBinary(
    Protobuf.Mesh.ToRadioSchema,
    create(Protobuf.Mesh.ToRadioSchema, {
      payloadVariant: {
        case: "packet",
        value: meshPacket,
      },
    }),
  );
}

describe("Queue", () => {
  it("formats known and unknown routing errors", () => {
    expect(getRoutingErrorName(Protobuf.Mesh.Routing_Error.NOT_AUTHORIZED)).toBe(
      "NOT_AUTHORIZED (33)",
    );
    expect(getRoutingErrorName(999 as Protobuf.Mesh.Routing_Error)).toBe("UNKNOWN (999)");
  });

  it("resolves packets that do not wait for ack after writing", async () => {
    const queue = new Queue();
    const writes: Uint8Array[] = [];
    const id = 1234;

    queue.push({
      id,
      data: buildToRadioPacket(id, false),
      waitForAck: false,
    });

    const ack = queue.wait(id);
    await queue.processQueue(
      new WritableStream<Uint8Array>({
        write(chunk) {
          writes.push(chunk);
        },
      }),
    );

    await expect(ack).resolves.toBe(id);
    expect(writes).toHaveLength(1);
  });

  it("keeps acked packets pending until processAck is called", async () => {
    const queue = new Queue();
    const id = 5678;

    queue.push({
      id,
      data: buildToRadioPacket(id, true),
      waitForAck: true,
    });

    await queue.processQueue(
      new WritableStream<Uint8Array>({
        write() {},
      }),
    );

    const ack = queue.wait(id);
    queue.processAck(id);

    await expect(ack).resolves.toBe(id);
  });
});
