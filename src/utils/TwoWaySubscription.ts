import { Transform, TransformCallback, TransformOptions } from "stream";

import { ClientDuplexStream, ServiceError } from "@grpc/grpc-js";
import { Status } from "@grpc/grpc-js/build/src/constants";

import { ReadReq, ReadResp } from "../../generated/persistent_pb";
import Action = ReadReq.Nack.Action;

import { convertToCommandError, convertGrpcEvent, createUUID } from ".";
import {
  PersistentAction,
  PersistentSubscription,
  ResolvedEvent,
} from "../types";

type CreateGRPCStream = () => Promise<ClientDuplexStream<ReadReq, ReadResp>>;

export class TwoWaySubscription
  extends Transform
  implements PersistentSubscription
{
  #grpcStream: Promise<ClientDuplexStream<ReadReq, ReadResp>>;

  constructor(createGRPCStream: CreateGRPCStream, options: TransformOptions) {
    super({ ...options, objectMode: true });
    this.#grpcStream = createGRPCStream();
    this.initialize();
  }

  private initialize = async () => {
    try {
      (await this.#grpcStream)
        .on("error", (err: ServiceError) => {
          if (err.code === Status.CANCELLED) return;
          const error = convertToCommandError(err);
          this.emit("error", error);
        })
        .pipe(this);
    } catch (error) {
      this.emit("error", error);
    }
  };

  _transform(resp: ReadResp, _encoding: string, next: TransformCallback): void {
    if (resp.hasSubscriptionConfirmation()) {
      this.emit("confirmation");
    }

    if (resp.hasEvent()) {
      const resolved = convertGrpcEvent(resp.getEvent()!);
      next(null, resolved);
      return;
    }

    next();
  }

  public async ack(...events: Array<string | ResolvedEvent>): Promise<void> {
    const req = new ReadReq();
    const ack = new ReadReq.Ack();

    for (const event of events) {
      const id =
        typeof event === "string" ? event : event.link?.id ?? event.event?.id;

      // A resolved event will always have either link or event (or both), so this should to be unreachable
      if (!id) throw new Error("Attempted to ack an event with no id");

      const uuid = createUUID(id);
      ack.addIds(uuid);
    }

    req.setAck(ack);

    const stream = await this.#grpcStream;
    return new Promise((resolve, reject) => {
      try {
        stream.write(req, resolve);
      } catch (error) {
        reject(convertToCommandError(error));
      }
    });
  }

  public async nack(
    action: PersistentAction,
    reason: string,
    ...events: Array<string | ResolvedEvent>
  ): Promise<void> {
    const req = new ReadReq();
    const nack = new ReadReq.Nack();

    switch (action) {
      case "park":
        nack.setAction(Action.PARK);
        break;
      case "retry":
        nack.setAction(Action.RETRY);
        break;
      case "skip":
        nack.setAction(Action.SKIP);
        break;
      case "stop":
        nack.setAction(Action.STOP);
        break;
    }

    for (const event of events) {
      const id =
        typeof event === "string" ? event : event.link?.id ?? event.event?.id;

      // A resolved event will always have either link or event (or both), so this should to be unreachable
      if (!id) throw new Error("Attempted to ack an event with no id");

      const uuid = createUUID(id);
      nack.addIds(uuid);
    }

    nack.setReason(reason);

    req.setNack(nack);

    const stream = await this.#grpcStream;
    return new Promise((resolve, reject) => {
      try {
        stream.write(req, resolve);
      } catch (error) {
        reject(convertToCommandError(error));
      }
    });
  }

  public async unsubscribe(): Promise<void> {
    const stream = await this.#grpcStream;

    return new Promise((resolve) => {
      // https://github.com/grpc/grpc-node/issues/1464
      // https://github.com/grpc/grpc-node/issues/1652
      setImmediate(() => {
        stream.cancel();
        resolve();
      });
    });
  }
}
