// This module uses a cursed state machine where each state is handled by a
// function that returns the next state function. `replace` will call the
// sequence of functions until the stream ends. This avoids the need for
// `switch` based on state and also avoids deepening the call stack.
//
// When a state function must stop because the chunk reached its end, it will be
// called again once there's more input.
//
// As state functions can be stopped then later resumed, it is necessary for
// them to somehow hold state. This is done by using the `stateBuffer` property
// in the context object, which is only reset when state changes to a different
// function.

import { Transform, TransformCallback } from "node:stream";
import { SwapData, DataNode } from "./swap-data.js";
import SwapDirectiveTemplate from "./swap-directive-template.js";

/**
 * Gets a value from the swap data using a value path.
 * @param data - Swap data.
 * @param valuePath - A swap path to access a value in {@link data}.
 * @param separator - Separator token for the swap path.
 * @returns Resulting value.
 */
function getValue(
  data: SwapData,
  valuePath: string,
  separator: string,
): string {
  let value: DataNode = data;

  for (const segment of valuePath.split(separator)) {
    if (typeof value === "string" || value instanceof String) {
      throw new TypeError(
        `Tried to index into a leaf value in path "${valuePath}"`,
      );
    }

    const newValue: DataNode | undefined = value[segment];
    if (newValue == null) {
      throw new TypeError(
        `Tried to index with a non-existent key "${segment}" in path "${valuePath}"`,
      );
    }
    value = newValue;
  }

  if (typeof value !== "string" && !(value instanceof String)) {
    throw new TypeError(`Value path "${valuePath}" didn't reach a leaf value`);
  }
  return value as string;
}

/** Context used for text processing functions. */
interface ProcessingContext {
  /** Current input chunk. */
  input: string;

  /**
   * Output for the current chunk at {@link input}.
   * If a chunk ends mid-directive, the directive's result will be written after
   * a new chunk finishes the directive. This works because {@link stateBuffer}
   * is preserved cross-chunk.
   */
  output: string;

  /** Swap data for the processor. */
  swapData: SwapData;

  /** Swap directive template to use. */
  template: SwapDirectiveTemplate;

  /**
   * Auxiliary buffer for the current state. It is reset on every transition to
   * a different state, but preserved when the state is resumed from exceptions.
   */
  stateBuffer: string;

  /** Next index to be treated from {@link input}. */
  nextIndex: number;
}

/**
 * A function that represents an interruptible and resumable step in the text
 * processing for {@link SwapTransform}.
 */
type StateFunction = (context: ProcessingContext) => StateFunction;

/**
 * Creates a state function that consumes whitespace until it finds another kind
 * of character, then returns the provided {@link nextState}.
 * The created state also appends all consumed characters to
 * {@link ProcessingContext} match fail buffer.
 * @param nextState - Next state function.
 * @returns State function that consumes whitespace.
 */
function consumeWhitespaceAndThen(nextState: StateFunction) {
  return function whitespaceConsumerState(context: ProcessingContext) {
    const { input } = context;

    let last = input[context.nextIndex];
    while (last != null && /\s/.test(last)) {
      last = input[++context.nextIndex];
    }
    if (last == null) {
      // Lend control to wait for more chunks.
      return whitespaceConsumerState;
    }

    return nextState;
  };
}

/**
 * @param context - Processing context.
 * @returns Next state function.
 */
function lookingForDirectiveState(context: ProcessingContext): StateFunction {
  const { input, template } = context;

  while (context.stateBuffer.length < template.start.length) {
    const last = input[context.nextIndex++];
    if (last == null) {
      // Lend control to wait for more chunks.
      return lookingForDirectiveState;
    }

    if (last === context.template.start[context.stateBuffer.length]) {
      context.stateBuffer += last;
    } else {
      context.output += `${context.stateBuffer}${last}`;
      context.stateBuffer = "";
    }
  }

  return consumeWhitespaceAndThen(inDirectiveState);
}

/**
 * @param context - Processing context.
 * @returns Next state function.
 */
function inDirectiveState(context: ProcessingContext): StateFunction {
  const { swapData, input, template } = context;

  let last = input[context.nextIndex++];
  if (last == null) {
    // Lend control to wait for more chunks.
    return inDirectiveState;
  }

  context.stateBuffer += last;

  while (!context.stateBuffer.endsWith(template.end)) {
    if (context.stateBuffer.length > 1024)
      throw new Error(
        "Swap directive path is too long (over 1024 characters!). The directive end token is likely missing.",
      );

    last = input[context.nextIndex++];
    if (last == null) return inDirectiveState; // Lend control to wait for more chunks.

    context.stateBuffer += last;
  }

  const value = getValue(
    swapData,
    context.stateBuffer.slice(0, -template.end.length).trim(),
    template.separator,
  );

  context.output += value;

  return lookingForDirectiveState;
}

/** Parameters for {@link SwapTransform}. */
interface SwapTransformParameters {
  /** Swap data for the processor. */
  swapData: SwapData;

  /** Swap directive template to use. */
  template: SwapDirectiveTemplate;
}

/**
 * A transform that swaps swap directives for their values, while preserving
 * unrelated text.
 */
export class SwapTransform extends Transform {
  /** Next {@link StateFunction | state function} to be executed. */
  #nextState: StateFunction = lookingForDirectiveState;

  /** Context required by {@link StateFunction | state functions}. */
  #context: ProcessingContext;

  /**
   * Constructs a new {@link SwapTransform}.
   * @param parameters - Construction parameters.
   */
  constructor(parameters: SwapTransformParameters) {
    super();

    this.#context = {
      ...parameters,
      input: "",
      output: "",
      stateBuffer: "",
      nextIndex: 0,
    };
  }

  override _transform(
    chunk: unknown,
    _encoding: BufferEncoding,
    callback: TransformCallback,
  ) {
    this.#context.input = String(chunk);
    this.#context.nextIndex = 0;

    while (this.#context.nextIndex < this.#context.input.length) {
      try {
        const newState = this.#nextState(this.#context);
        if (newState !== this.#nextState) {
          this.#context.stateBuffer = "";
          this.#nextState = newState;
        }
      } catch (error) {
        if (error instanceof Error) callback(error);
        return;
      }
    }

    this.push(this.#context.output, "utf8");
    this.#context.output = "";

    callback();
  }
}

export default SwapTransform;
