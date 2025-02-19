# Markdown Tokens

Markdown tokens are a syntax extension for Markdown that work as placeholders
for custom content.

> **NOTE**: This library is still in development and the API is subject to
> change. Future work:
>
> - Formal specification of the syntax.
> - Fix position information in the AST.

## Basics

A token can be any text that does not contain whitespace, carets (`^`) or colons
(`:`). In the example below, `hello` is a token. It can be used in Markdown by
surrounding it with colons. This syntax may already be familiar to you if you
have used emojis in GitHub or Slack.

```markdown
:hello:
```

The `parseTokens` function exported by this library can be applied to the root
of a Markdown AST in order to parse tokens in text nodes. For example, here it
is used with unified and remark:

```js
import remarkParse from "https://esm.sh/remark-parse@11.0.0";
import { unified } from "https://esm.sh/unified@11.0.4";
import { parseTokens } from "./mod.ts";

const root = unified()
  .use(remarkParse)
  .parse(":hello:");

unified()
  .use(() => parseTokens)
  .run(root);

console.log(root);
```

The text `:hello:` is parsed into a separate node with the token stored in
`data.token`.

```json
{
  "type": "root",
  "children": [{
    "type": "text",
    "value": ":hello:",
    "data": {
      "token": "hello"
    }
  }]
}
```

The interpretation of a token is left to the renderer of the document. For
example, `:hello:` could be replaced with a waving hand emoji, an image of a
greeting card, or a button that opens a popup that says "hello". In the example
below, the token is rendered as JSX:

```js
function renderNode(node) {
  if (isToken(node)) {
    if (node.data.token === "hello") {
      return <strong>Hello, world!</strong>;
    }
    // Render other tokens...
  }
  // Render other nodes...
}
```

## Parameters

A token can encode granular data, as long as it contains no colons or spaces.
One approach that's flexible and reasonably easy for a human to read and write
is to use a pathname and query string.

```markdown
:icon/heart?color=red:
```

JavaScript provides the native `URL` class that can be used for parsing such
strings. Remember to prefix it with a dummy schema, such as `token:///`, to make
it a valid URI.

```jsx
function renderToken(token) {
  const uri = new URL("token:///" + token);
  if (uri.pathname.startsWith("/icon/")) {
    const icon = uri.pathname.slice("/icon/".length);
    const color = uri.searchParams.get("color");
    return <Icon name={icon} color={color} />;
  }
}
```

> **TIP**: Consider caching the parse result to avoid redundant work if the same
> token is used multiple times in the document.

## Assignment

Tokens cannot only be used to insert content, but also to enhance other content
in a document. For example, you may want to display a list item with a circle
instead of a default bullet. This can be achieved by _assigning_ a token to a
nearby document node using the `^` operator.

The `^` operator must be inside the colons and can come either before or after
the token. If it comes before, the token is assigned to the _previous_ node. If
it comes after, the token is assigned to the _next_ node.

```markdown
- :^bullet/circle: Special item
- Regular item
```

> <li style="list-style-type: circle">Special item</li>
> <li>Regular item</li>

The text `:^bullet/circle:` and adjacent whitespace is removed entirely from the
document and the token is stored in `data.tokens` of the list item.

```json
{
  "type": "root",
  "children": [{
    "type": "list",
    "children": [{
      "type": "listItem",
      "children": [{
        "type": "paragraph",
        "children": [{
          "type": "text",
          "value": "Hello, world!"
        }],
        "data": {
          "tokens": ["icon/heart"]
        }
      }]
    }]
  }]
}
```

Inline nodes take precedence when determining the target node. In the following
example, the text nodes inside the items get color tokens, not the list items
themselves.

```markdown
- :cyan^: Item 1
- Item 2 :^magenta:
```

> - <span style="color:cyan">Item 1</span>
> - <span style="color:magenta">Item 2</span>

If there is no adjacent inline node to assign the token to, the token is instead
assigned to the parent block. In the example below, the tokens are assigned to
the list item nodes.

```markdown
- :^blue: Item 1
- Item 2 :magenta^:
```

> <ul>
> <li style="color:cyan">Item 1</li>
> <li style="color:magenta">Item 2</li>
> </ul>

If the parent block is a paragraph that would end up empty after parsing, the
paragraph is removed entirely. The tokens are then assigned to the nearest
blocks, again depending on the position of the `^` operator. In the example
below, the first block gets the `cyan` token and the second block gets the
`magenta` token. The order of the tokens does not matter in this case.

```markdown
Paragraph 1

:^cyan: :magenta^:

Paragraph 2
```

> <p style="color:cyan">Paragraph 1</p>
> <p style="color:magenta">Paragraph 2</p>

If there is no nearest block, then the token will be applied to the root node.

```markdown
:^cyan:

Paragraph 1

Paragraph 2
```

> <div style="color:cyan">
> <p>Paragraph 1</p>
> <p>Paragraph 2</p>
> </div>
