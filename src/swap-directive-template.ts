/** A template for a swap directive. */
export class SwapDirectiveTemplate {
  /**
   * Creates a {@link SwapDirectiveTemplate | swap directive template} from a
   * string.
   *
   * Leading and trailing whitespace will be ignored.
   * @param string_ - String in the format `<start> <separator> <end>`.
   * @returns Newly constructed directive template.
   * @throws {Error} If the string is invalid.
   * @example
   * // Will match strings such as <!colors.red!>
   * const a = SwapDirectiveTemplate.fromString("<! . !>");
   *
   * // Will match strings such as #! settings@graphics@shadows <#
   * const b = SwapDirectiveTemplate.fromString("#! @ <#");
   */
  static fromString(string_: string): SwapDirectiveTemplate {
    const [start, separator, end, ...rest] = string_.trim().split(/\s+/);

    if (rest.length > 0) {
      throw new Error(
        `Invalid directive template "${string_}" has too many tokens.`,
      );
    }

    if (start == null || separator == null || end == null) {
      throw new Error(
        `Invalid directive template "${string_}" has too few tokens.`,
      );
    }

    return new SwapDirectiveTemplate(start, separator, end);
  }

  /** Swap directive start token. */
  start: string;

  /** Swap directive path separator token. */
  separator: string;

  /** Swap directive end token. */
  end: string;

  /**
   * Creates a new swap directive template.
   * @param start - Start token.
   * @param separator - Path separator token.
   * @param end - End token.
   */
  constructor(start: string, separator: string, end: string) {
    this.start = start;
    this.separator = separator;
    this.end = end;
  }
}

export default SwapDirectiveTemplate;
