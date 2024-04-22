import { createWriteStream } from "node:fs";
import { copyFile } from "node:fs/promises";
import { Writable } from "node:stream";
import tmp from "tmp";

tmp.setGracefulCleanup();

/**
 * A writable that writes to a temporary file then copies it to the destination
 * path.
 *
 * This makes it so that partial outputs are never produced at the destination
 * path.
 */
export class TemporaryFileWritable extends Writable {
  /** Path to write to after the stream ended. */
  #destinationPath: string;

  /** Path to the temporary file. */
  #temporaryPath: string;

  /** Writable to write to the temporary file. */
  #temporaryWritable: Writable;

  /**
   * Constructs a {@link TemporaryFileWritable}.
   * @param path - Path to write to after the stream ended.
   */
  constructor(path: string) {
    super();

    this.#destinationPath = path;

    const temporary = tmp.fileSync();
    this.#temporaryPath = temporary.name;
    this.#temporaryWritable = createWriteStream("", { fd: temporary.fd });
  }

  override _write(
    chunk: unknown,
    encoding: BufferEncoding,
    callback: (error?: Error | null) => void,
  ) {
    this.#temporaryWritable.write(chunk, encoding, callback);
  }

  override _final(callback: (error?: Error | null) => void) {
    this.#temporaryWritable.once("finish", () => {
      void copyFile(this.#temporaryPath, this.#destinationPath).then(() => {
        callback();
      });
    });
    this.#temporaryWritable.end();
  }
}

export default TemporaryFileWritable;
