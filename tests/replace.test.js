import { describe, it } from "node:test";
import { pipeline } from "node:stream/promises";
import { Readable, Writable } from "node:stream";
import { SwapDirectiveTemplate } from "#compiled/swap-directive-template.js";
import { SwapTransform } from "#compiled/swap-transform.js";
import assert from "node:assert";

/** A writable that saves the content written to it in a string. */
class StringWritable extends Writable {
  /**
   * Contents written to the writable.
   * @type {string}
   */
  #string = "";

  /**
   * @override
   * @param {*} chunk - Chunk to write.
   * @param {BufferEncoding} _ - Unused.
   * @param {(error?: Error | null) => void} callback - Callback for when this
   * chunk of data is flushed.
   */
  _write(chunk, _, callback) {
    this.#string += String(chunk);
    callback();
  }

  /**
   * Shows the contents written to the writable.
   * @override
   */
  toString() {
    return this.#string;
  }
}

await describe("Replace", async () => {
  await it("Replaces once", async () => {
    let output = new StringWritable();
    await pipeline(
      Readable.from('console.log(access("numbers.one"))'),
      new SwapTransform({
        swapData: {
          numbers: {
            one: "1",
          },
        },
        template: SwapDirectiveTemplate.fromString(`access(" . ")`),
      }),
      output,
    );
    assert.equal(output.toString(), "console.log(1)");

    output = new StringWritable();
    await pipeline(
      Readable.from("The frame rate is >><config.graphics.framerate<<>!"),
      new SwapTransform({
        swapData: {
          config: {
            audio: { enabled: "false" },
            graphics: {
              antiAliasing: "true",
              framerate: "60",
            },
          },
        },
        template: SwapDirectiveTemplate.fromString(`>>< . <<>`),
      }),
      output,
    );
    assert.equal(output.toString(), "The frame rate is 60!");
  });

  await it("Replaces with spaces between swap path and tokens", async () => {
    const output = new StringWritable();

    await pipeline(
      Readable.from("The color is <!  color.red   !>"),
      new SwapTransform({
        swapData: { color: { red: "#ff0000" } },
        template: SwapDirectiveTemplate.fromString("<! . !>"),
      }),
      output,
    );
    assert.equal(output.toString(), "The color is #ff0000");
  });

  await it("Replaces with single-character start and end tokens", async () => {
    const output = new StringWritable();

    await pipeline(
      Readable.from("!color@red!"),
      new SwapTransform({
        swapData: { color: { red: "#ff0000" } },
        template: SwapDirectiveTemplate.fromString("! @ !"),
      }),
      output,
    );
    assert.equal(output.toString(), "#ff0000");
  });

  await it("Replaces with multi-character separator", async () => {
    const output = new StringWritable();

    await pipeline(
      Readable.from("<!color->red!>"),
      new SwapTransform({
        swapData: { color: { red: "#ff0000" } },
        template: SwapDirectiveTemplate.fromString("<! -> !>"),
      }),
      output,
    );
    assert.equal(output.toString(), "#ff0000");
  });

  await it("Replaces multiple", async () => {
    const output = new StringWritable();
    await pipeline(
      Readable.from("color: <!color.red!>;\nbackground-color: <!color.blue!>;"),
      new SwapTransform({
        swapData: { color: { red: "#ff0000", blue: "#0000ff" } },
        template: SwapDirectiveTemplate.fromString("<! . !>"),
      }),
      output,
    );

    assert.equal(
      output.toString(),
      "color: #ff0000;\nbackground-color: #0000ff;",
    );
  });

  // This checks that the transform can work with 1-character-long chunks.
  // Pretty awesome innit?
  await it("Works with 1-length chunks", async () => {
    const output = new StringWritable();
    await pipeline(
      function* () {
        for (const char of "The frame rate is >><config.graphics.framerate<<>!") {
          yield char;
        }
      },
      new SwapTransform({
        swapData: {
          config: {
            audio: { enabled: "false" },
            graphics: {
              antiAliasing: "true",
              framerate: "60",
            },
          },
        },
        template: SwapDirectiveTemplate.fromString(`>>< . <<>`),
      }),
      output,
    );
    assert.equal(output.toString(), "The frame rate is 60!");
  });

  await it("Throws correctly on non-existent key", async () => {
    await assert.rejects(
      pipeline(
        Readable.from("<!color.red!>"),
        new SwapTransform({
          swapData: { color: {} },
          template: SwapDirectiveTemplate.fromString("<! . !>"),
        }),
        new StringWritable(),
      ),
      {
        message: `Tried to index with a non-existent key "red" in path "color.red"`,
      },
    );
  });

  await it("Throws correctly on no leaf reached", async () => {
    await assert.rejects(
      pipeline(
        Readable.from("<!color.dark!>"),
        new SwapTransform({
          swapData: { color: { dark: { red: "#ff0000" } } },
          template: SwapDirectiveTemplate.fromString("<! . !>"),
        }),
        new StringWritable(),
      ),
      { message: `Value path "color.dark" didn't reach a leaf value` },
    );
  });

  await it("Throws correctly on trying to index into a leaf", async () => {
    await assert.rejects(
      pipeline(
        Readable.from("<!color.red.dark!>"),
        new SwapTransform({
          swapData: { color: { red: "#ff0000" } },
          template: SwapDirectiveTemplate.fromString("<! . !>"),
        }),
        new StringWritable(),
      ),
      {
        message: `Tried to index into a leaf value in path "color.red.dark"`,
      },
    );
  });
});
