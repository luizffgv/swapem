#!/usr/bin/env node

import { createReadStream, readFileSync } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { hideBin } from "yargs/helpers";
import yargs from "yargs/yargs";
import { SwapData } from "./swap-data.js";
import SwapDirectiveTemplate from "./swap-directive-template.js";
import { SwapTransform } from "./swap-transform.js";
import TemporaryFileWritable from "./cli/temporary-file-writable.js";

await yargs(hideBin(process.argv))
  .scriptName("swapem")
  .example(
    '$0 --input-file input.txt --data-file data.json --template "( . )"',
    "Reads input.txt and writes its contents to stdout with swap directives replaced by their values specified in data.json",
  )
  .example(
    `$0 --input-inline "color: var(--color-red);" --template "var(-- - )" --data-inline '{"color": {"red": "#ff0000"}}'`,
    "Reads input-inline and writes its contents to stdout with var(--color-red) replaced by #ff0000",
  )
  .command(
    "$0 [options]",
    "Substitute directives in text",
    (yargs) =>
      yargs
        .option("data-file", {
          describe:
            "Path to a JSON file containing data to be used by the processor when substituting.",
          type: "string",
        })
        .option("data-inline", {
          describe:
            "A string containing the JSON representation of the data to be used by the processor when substituting.",
          type: "string",
        })
        .conflicts("data-file", "data-inline")
        .group(
          ["data-file", "data-inline"],
          "Data input [mutually exclusive] [required]:",
        )
        .check((argv) => {
          if (argv["data-file"] == null && argv["data-inline"] == null) {
            throw new Error(
              "Either data-file or data-inline must be specified.",
            );
          }

          return true;
        })
        .option("input-file", {
          describe:
            "Path to the input text file possibly containing swap directives to be replaced.",
          type: "string",
        })
        .option("input-inline", {
          describe:
            "Input text possibly containing swap directives to be replaced.",
          type: "string",
        })
        .conflicts("input-file", "input-inline")
        .group(
          ["input-file", "input-inline"],
          "Text input (will use stdin if not specified) [mutually exclusive]:",
        )
        .option("template", {
          alias: "t",
          describe:
            "A swap directive template following the pattern <start> <separator> <end>, where <start> and <end> are the start and end sequences of a swap directive and <separator> is a swap path nesting separator.",
          type: "string",
          demandOption: true,
        })
        .option("output", {
          alias: "o",
          describe: "Output file",
          type: "string",
        }),
    async (argv) => {
      const input =
        argv.inputFile == null
          ? argv.inputInline == null
            ? process.stdin
            : Readable.from(argv.inputInline)
          : createReadStream(path.resolve(process.cwd(), argv.inputFile), {
              encoding: "utf8",
            });

      const dataString =
        argv.dataFile == null
          ? argv.dataInline
          : readFileSync(path.resolve(process.cwd(), argv.dataFile), {
              encoding: "utf8",
            });
      if (dataString == null) {
        throw new Error(
          "dataString is undefined, this should never be thrown and is a bug.",
        );
      }

      const definitions = SwapData.safeParse(JSON.parse(dataString));

      if (!definitions.success) {
        throw new Error(
          `Failed to parse JSON data: ${definitions.error.message}`,
        );
      }

      const output = (() => {
        if (argv.output == null) {
          return process.stdout;
        } else {
          const outputFilePath = path.resolve(process.cwd(), argv.output);
          return new TemporaryFileWritable(outputFilePath);
        }
      })();

      await pipeline(
        input,
        new SwapTransform({
          swapData: definitions.data,
          template: SwapDirectiveTemplate.fromString(argv.template),
        }),
        output,
      );
    },
  )
  .parse();
