# Markdown Tokens

Markdown tokens are a syntax extension for Markdown that work as placeholders
for custom content.

> **NOTE**: This library is still in development and the API is subject to
> change. Planned work:
>
> - Export a unified plugin that modifies the AST in place.
> - Document the `^` syntax for assigning tokens to AST nodes.

## Usage

A token can be any text that does not contain whitespace or colons (`:`). In the
example below, `hello` is a token. It can be used in Markdown by surrounding it
with colons. This syntax may already be familiar to you if you have used emojis
in GitHub or Slack.

```markdown
:hello:
```

This library exports a `parseTokens` function that can be applied to the root of
a Markdown AST as produced by remark.

```js
import remarkParse from "https://esm.sh/remark-parse@11.0.0";
import { unified } from "https://esm.sh/unified@11.0.4";
import { parseTokens } from "mod.ts";

const root = parseTokens(
  unified()
    .use(remarkParse)
    .parse(":hello:"),
);

console.log(root);
```

```json
{
  "type": "root",
  "children": [
    {
      "type": "text",
      "value": ":hello:",
      "data": {
        "token": "hello"
      }
    }
  ]
}
```

The interpretation of a token is left to the renderer of the document. For
example, `:hello:` could be replaced with a customized greeting, an image of a
greeting card, or a button that opens a popup that says "hello". In the example
below, the token is rendered as a React component:

```js
function renderNode(node) {
  if (isToken(node)) {
    if (node.data.token === "hello") {
      return <strong>Hello, world!</strong>;
    }
  }
  // Render other types of nodes...
}
```

## Parameters

For more complex use cases, a token can encode granular data as well. One way
that's easy for a human to read and write is to use a pathname and query string.

```markdown
:icon/heart?color=red:
```

JavaScript provides the native `URL` class that can be used for parsing such a
token. Remember to prefix it with a dummy schema, such as `token:///`, to make
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
