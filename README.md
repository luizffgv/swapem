# Swapem

**Swapem** is a text processor that can find **swap directives** inside a text
stream and replace them by the values they ask for.

You can use swapem as a Node module or via CLI with `npx`.

## How does this work?

### General definitions

Swapem analyzes a text stream and looks for swap directives. A swap
directive consists of 3 parts: a **start token**, a **swap path** and an
**end token**.

A start token is a sequence of characters that mark the start of a swap
directive. After the start token there is the **swap path**, which is a sequence
of strings joined by a **path separator token**. Then there is the end token.

You can choose the start token, the path separator token and the end token by
providing a **swap directive template** such as `<! -> !>`, where `<!` is the
start token, `!>` is the end token and `->` is the path separator. This example
template will match directives like `<!colors->red!>` or
`<! layout->main->width  !>`.

### Accessing data

Swap paths are called paths for a reason: they are used to traverse a tree of
data. This tree is called **swap data** and can be provided through Node
directly, or in the CLI as a JSON file or as inline JSON.

Each swap data node can be either a string (leaf node) or an object containing
child data nodes.

The directive `<colors.red>` (template `< . >`) will access the `colors` node
in the swap data and then reach the `red` leaf node inside it. The whole
directive will be replaced by `#ff0000` per the following JSON:

```json
{
  "colors": {
    "red": "#ff0000"
  }
}
```

If the provided swap path is invalid or ends on a non-leaf node, an error will
be thrown.

## Example usage

### Inputs

#### Swap directive template

`buildvar(-- - )`

#### Swap data

```json
{
  "colors": {
    "red": "#ff0000"
  },
  "sizes": {
    "text": {
      "medium": "1rem"
    }
  }
}
```

#### Text

```css
p {
  color: buildvar(--colors-red);
  font-size: buildvar(--sizes-text-medium);
}
```

### Output

```css
p {
  color: #ff0000;
  font-size: 1rem;
}
```
