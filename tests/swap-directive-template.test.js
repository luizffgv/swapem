import { describe, it } from "node:test";
import { SwapDirectiveTemplate } from "#compiled/swap-directive-template.js";
import assert from "node:assert";

await describe("fromString", async () => {
  await it("Works with a valid string separated by 1 space", () => {
    const { start, separator, end } =
      SwapDirectiveTemplate.fromString("<! . !>");
    assert.equal(start, "<!");
    assert.equal(separator, ".");
    assert.equal(end, "!>");
  });

  await it("Works with a valid string separated by many spaces", () => {
    const { start, separator, end } =
      SwapDirectiveTemplate.fromString("<!   .  !>");
    assert.equal(start, "<!");
    assert.equal(separator, ".");
    assert.equal(end, "!>");
  });

  await it("Works with a valid string with margin", () => {
    const { start, separator, end } =
      SwapDirectiveTemplate.fromString("   <! . !>   ");
    assert.equal(start, "<!");
    assert.equal(separator, ".");
    assert.equal(end, "!>");
  });

  await it("Throws correctly on missing tokens", () => {
    assert.throws(
      () => {
        SwapDirectiveTemplate.fromString("<!>");
      },
      {
        message: 'Invalid directive template "<!>" has too few tokens.',
      },
    );
  });

  await it("Throws correctly on too many tokens", () => {
    assert.throws(
      () => {
        SwapDirectiveTemplate.fromString("<! . !> !>");
      },
      {
        message: 'Invalid directive template "<! . !> !>" has too many tokens.',
      },
    );

    assert.throws(
      () => {
        SwapDirectiveTemplate.fromString("<! <! . !>");
      },
      {
        message: 'Invalid directive template "<! <! . !>" has too many tokens.',
      },
    );
  });
});
