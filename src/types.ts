import { v4 as uuid } from "uuid";

export type IRevision =
  | AnyRevision
  | StreamExistsRevision
  | NoStreamRevision
  | ExactRevision;

export type AnyRevision = {
  __typename: "any";
};

export type StreamExistsRevision = {
  __typename: "stream_exists";
};

export type NoStreamRevision = {
  __typename: "no_stream";
};

export type ExactRevision = {
  __typename: "exact";
  revision: number;
};

export class Revision {
  static readonly Any: IRevision = {
    __typename: "any",
  };

  static readonly StreamExists: IRevision = {
    __typename: "stream_exists",
  };

  static readonly NoStream: IRevision = {
    __typename: "no_stream",
  };

  static exact(revision: number): IRevision {
    return {
      __typename: "exact",
      revision,
    };
  }
}

export type Payload = JsonPayload | BinaryPayload;

export type JsonPayload = {
  __typename: "json";
  // eslint-disable-next-line
  payload: any;
};

export type BinaryPayload = {
  __typename: "binary";
  payload: Uint8Array;
};

export class Credentials {
  username: string;
  password: string;

  constructor(username: string, password: string) {
    this.username = username;
    this.password = password;
  }
}

export class EventDataBuilder {
  eventType: string;
  payload: JsonPayload | BinaryPayload;
  id: string | null;

  private constructor(
    eventType: string,
    payload: JsonPayload | BinaryPayload,
    id: string | null
  ) {
    this.eventType = eventType;
    this.payload = payload;
    this.id = id;
  }

  // eslint-disable-next-line
  static json(eventType: string, obj: any): EventDataBuilder {
    const payload: JsonPayload = {
      __typename: "json",
      payload: obj,
    };

    return new EventDataBuilder(eventType, payload, null);
  }

  static binary(eventType: string, buffer: Uint8Array): EventDataBuilder {
    const payload: BinaryPayload = {
      __typename: "binary",
      payload: buffer,
    };

    return new EventDataBuilder(eventType, payload, null);
  }

  eventId(id: string): EventDataBuilder {
    this.id = id;
    return this;
  }

  build(): EventData {
    const id: string = this.id != null ? this.id : uuid();
    return new EventData(this.eventType, this.payload, id);
  }
}

export class EventData {
  eventType: string;
  payload: JsonPayload | BinaryPayload;
  id: string;

  public constructor(
    eventType: string,
    payload: JsonPayload | BinaryPayload,
    id: string
  ) {
    this.eventType = eventType;
    this.payload = payload;
    this.id = id;
  }

  // eslint-disable-next-line
  static json(eventType: string, payload: any): EventDataBuilder {
    return EventDataBuilder.json(eventType, payload);
  }

  static binary(eventType: string, payload: Uint8Array): EventDataBuilder {
    return EventDataBuilder.binary(eventType, payload);
  }
}

export type Direction = Forward | Backward;

export type Forward = {
  __typename: "forward";
};

export const Forward: Forward = {
  __typename: "forward",
};

export type Backward = {
  __typename: "backward";
};

export const Backward: Backward = {
  __typename: "backward",
};

export class ReadDirection {
  static readonly Forward: Forward = {
    __typename: "forward",
  };

  static readonly Backward: Backward = {
    __typename: "backward",
  };
}

export type StreamRevision = StreamStart | StreamEnd | StreamExact;

export type StreamStart = {
  __typename: "start";
};

export type StreamEnd = {
  __typename: "end";
};

export type StreamExact = {
  __typename: "exact";
  revision: number;
};

export const StreamStart: StreamStart = {
  __typename: "start",
};

export const StreamEnd: StreamEnd = {
  __typename: "end",
};

export const StreamExact = (revision: number): StreamExact => {
  return {
    __typename: "exact",
    revision,
  };
};

export type Position = {
  commit: number;
  prepare: number;
};

export type StreamPosition = {
  __typename: "position";
  position: Position;
};

export const StreamPosition: (pos: Position) => StreamPosition = (pos) => {
  return {
    __typename: "position",
    position: pos,
  };
};
