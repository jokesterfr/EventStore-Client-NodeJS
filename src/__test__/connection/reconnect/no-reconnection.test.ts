import { createTestCluster, createTestNode, jsonTestEvents } from "@test-utils";
import {
  jsonEvent,
  EventStoreDBClient,
  StreamNotFoundError,
  TimeoutError,
} from "@eventstore/db-client";

// This test can take time.
jest.setTimeout(120_000);

describe("reconnect", () => {
  test("no reconnection is made if error is not for reconnecting", async () => {
    const cluster = createTestCluster();

    await cluster.up();

    const client = new EventStoreDBClient(
      {
        endpoints: cluster.endpoints,
        // The timing of this test can be a bit variable,
        // so it's better not to have deadlines here to force the errors we are testing.
        defaultDeadline: Infinity,
      },
      { rootCertificate: cluster.rootCertificate }
    );

    // make successful append to connect to node
    const firstAppend = await client.appendToStream(
      "my_stream",
      jsonEvent({ type: "first-append", data: { message: "test" } }),
      // batch append triggers reconnect as soon as stream drops, so we need to force regular append
      { credentials: { username: "admin", password: "changeit" } }
    );
    expect(firstAppend).toBeDefined();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const priorChannel = await (client as any).getChannel();

    try {
      // attempt to read a stream that doesnt exist
      for await (const event of client.readStream("doesn't-exist")) {
        expect(event).toBe("unreachable");
      }
    } catch (error) {
      expect(error).toBeInstanceOf(StreamNotFoundError);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const afterChannel = await (client as any).getChannel();

    expect(priorChannel).toBe(afterChannel);

    await cluster.down();
  });

  test("no reconnection for TimeoutError", async () => {
    const timeoutNode = createTestNode()
      .setOption("EVENTSTORE_COMMIT_TIMEOUT_MS", 1)
      .setOption("EVENTSTORE_PREPARE_TIMEOUT_MS", 1);

    await timeoutNode.up();

    const credentials = { username: "admin", password: "changeit" };
    const STREAM_NAME = "try_get_timeout";

    const client = new EventStoreDBClient(
      {
        endpoint: timeoutNode.uri,
        // The timing of this test can be a bit variable,
        // so it's better not to have deadlines here to force the errors we are testing.
        defaultDeadline: Infinity,
      },
      { rootCertificate: timeoutNode.rootCertificate }
    );

    // make successful append to connect to node
    const firstAppend = await client.appendToStream(
      "my_stream",
      jsonEvent({ type: "first-append", data: { message: "test" } }),
      // batch append triggers reconnect as soon as stream drops, so we need to force regular append
      { credentials }
    );
    expect(firstAppend).toBeDefined();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const priorChannel = await (client as any).getChannel();

    try {
      // try increasingly hard to hit the timeout
      for (let i = 5; i < 20; i += 5) {
        await Promise.all(
          Array.from({ length: i }, () =>
            client.appendToStream(STREAM_NAME, jsonTestEvents(30_000), {
              credentials,
            })
          )
        );
      }

      expect("this point").toBe("unreachable");
    } catch (error) {
      expect(error).toBeInstanceOf(TimeoutError);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const afterChannel = await (client as any).getChannel();

    expect(priorChannel).toBe(afterChannel);

    await timeoutNode.down();
  });
});