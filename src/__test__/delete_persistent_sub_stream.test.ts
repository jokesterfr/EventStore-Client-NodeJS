import * as eventstore from "../";
import { v4 as uuid } from "uuid";

describe("delete_persistent_sub", function () {
  it("should successfully delete a persistent subscription", async () => {
    const connection = eventstore.EventStoreConnection.builder()
      .sslDevMode()
      .build("localhost:2113");

    const streamName = `delete_persistent_sub-${uuid()}`;
    await connection
      .persistentSubscriptions()
      .create(streamName, "jokers")
      .authenticated("admin", "changeit")
      .execute();

    await connection
      .persistentSubscriptions()
      .delete(streamName, "jokers")
      .authenticated("admin", "changeit")
      .execute();

    expect(1).toBe(1);
  });
});
