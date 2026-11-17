import { Injectable } from "@nestjs/common";
import { DataSource, EntityManager } from "typeorm";

@Injectable()
export class TransactionRunner {
  private tail: Promise<void> = Promise.resolve();

  constructor(private readonly dataSource: DataSource) {}

  run<T>(work: (manager: EntityManager) => Promise<T>): Promise<T> {
    const result = this.tail.then(() => this.dataSource.transaction(work));
    this.tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}
