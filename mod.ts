import type {
  Node,
  Parent,
  Root,
  RootContent,
  Text,
} from "https://esm.sh/v135/@types/mdast@4.0.4/index.d.ts";
import "https://esm.sh/v135/@types/unist@3.0.2/index.d.ts";

/** HELPERS **/

type Border<T> = {
  before: T;
  after: T;
};

type Fragment = {
  children: Node[];
  tokens: Border<string[]>;
  space: Border<boolean>;
};

function isText(node: Node): node is Text {
  return node.type === "text";
}

function isParent(node: Node): node is Parent {
  return "children" in node;
}

function pushTokens(node: Node, tokens: string[]) {
  if (!tokens.length) return node;
  if (!node.data) node.data = {};
  if (!node.data.tokens) node.data.tokens = [];
  node.data.tokens.push(...tokens);
}

function concat(a: Fragment, b: Fragment): Fragment {
  const childBefore: undefined | Node = a.children[a.children.length - 1];
  const childAfter: undefined | Node = b.children[0];

  if (!childBefore && !childAfter) {
    return {
      children: [],
      tokens: {
        before: [...a.tokens.before, ...b.tokens.before],
        after: [...a.tokens.after, ...b.tokens.after],
      },
      space: {
        before: a.space.before || b.space.before,
        after: a.space.after || b.space.after,
      },
    };
  }

  if (!childBefore) {
    pushTokens(childAfter, a.tokens.after);
    return {
      children: b.children,
      tokens: {
        before: [...a.tokens.before, ...b.tokens.before],
        after: b.tokens.after,
      },
      space: {
        before: a.space.before || b.space.before,
        after: b.space.after,
      },
    };
  }

  if (!childAfter) {
    pushTokens(childBefore, b.tokens.before);
    return {
      children: a.children,
      tokens: {
        before: a.tokens.before,
        after: [...a.tokens.after, ...b.tokens.after],
      },
      space: {
        before: a.space.before,
        after: a.space.after || b.space.after,
      },
    };
  }

  const text = { type: "text", value: " " };
  pushTokens(childBefore, b.tokens.before);
  pushTokens(childAfter, a.tokens.after);
  return {
    children: [
      ...a.children,
      ...(a.space.after || b.space.before) ? [text] : [],
      ...b.children,
    ],
    tokens: {
      before: a.tokens.before,
      after: b.tokens.after,
    },
    space: {
      before: a.space.before,
      after: b.space.after,
    },
  };
}

function createPattern() {
  // Sub-patterns of the regex.
  const before = ":\\^";
  const after = "\\^:";
  const sep = ":";
  const token = "[^\\^:\\s]+";
  const ws = "\\s*";

  // Helper functions.
  const group = (...patterns: string[]) => `(${patterns.join("")})`;
  const union = (...patterns: string[]) => patterns.join("|");

  // This is an unconventional way of writing a regex.
  // It is written as such in order to make it easy to count groups
  // and reuse repeated sub-patterns.
  const pattern = union(
    // Neutral token.
    group(sep, group(token), sep),
    // Token bound to the node before.
    group(group(ws), before, group(token), sep, group(ws)),
    // Token bound to the node after.
    group(group(ws), sep, group(token), after, group(ws)),
  );

  return new RegExp(pattern, "g");
}

function* parseText(text: string): Iterable<Fragment> {
  const pattern = createPattern();

  let match;
  let cursor = 0;

  while ((match = pattern.exec(text)) !== null) {
    const prefix = text.slice(cursor, match.index);
    cursor = pattern.lastIndex;

    // Text before current token.
    if (prefix.length) {
      const text = { type: "text", value: prefix };
      yield {
        children: [text],
        tokens: { before: [], after: [] },
        space: { before: false, after: false },
      };
    }

    if (match[1] !== undefined) {
      // Neutral token.
      const token: Token = {
        type: "text",
        value: ":" + match[2] + ":",
        data: { token: match[2] },
      };
      yield {
        children: [token],
        tokens: { before: [], after: [] },
        space: { before: false, after: false },
      };
    } else if (match[3] !== undefined) {
      // Token bound to the node before.
      const text = match[5];
      const after = match[6];
      const space = after.length > 0;
      yield {
        children: [],
        tokens: { before: [text], after: [] },
        space: { before: space, after: space },
      };
    } else if (match[7] !== undefined) {
      // Token bound to the node after.
      const before = match[8];
      const text = match[9];
      const space = before.length > 0;
      yield {
        children: [],
        tokens: { before: [], after: [text] },
        space: { before: space, after: space },
      };
    }
  }

  // Text after last token.
  const suffix = text.slice(cursor);
  if (suffix.length) {
    const text = { type: "text", value: suffix };
    yield {
      children: [text],
      tokens: { before: [], after: [] },
      space: { before: false, after: false },
    };
  }
}

function parseNode(node: Parent): Fragment {
  let state: Fragment = {
    children: [],
    tokens: { before: [], after: [] },
    space: { before: false, after: false },
  };

  for (let i = 0; i < node.children.length; i++) {
    const child = node.children[i];

    if (isParent(child)) {
      // Parse parent nodes.
      const result = parseNode(child);
      state = concat(state, result);
    } else if (isText(child)) {
      if (child.data?.tokens?.length ?? 0 > 0) {
        throw new Error("Text node already has tokens. This is not supported.");
      }

      // Parse text nodes.
      for (const fragment of parseText(child.value)) {
        state = concat(state, fragment);
      }
    } else {
      // Any remaining literal node should just be appended.
      state = concat(state, {
        children: [child],
        tokens: { before: [], after: [] },
        space: { before: false, after: false },
      });
    }
  }

  // Dissolve empty paragraphs so its tokens are applied to neighbor blocks.
  // This must happen **after** the children are parsed.
  if (node.type === "paragraph" && !state.children.length) {
    return state;
  }

  node.children = state.children as RootContent[];

  // Apply the fragment to the element.
  pushTokens(node, [
    ...state.tokens.before,
    ...state.tokens.after,
  ]);

  return {
    children: [node],
    tokens: { before: [], after: [] },
    space: { before: false, after: false },
  };
}

/** MAIN **/

declare module "https://esm.sh/v135/@types/mdast@4.0.4/index.d.ts" {
  interface Data {
    tokens?: string[];
  }

  interface TextData {
    token?: string;
  }
}

export type Token = Text & {
  data: {
    token: string;
  };
};

export function isToken(node: Node): node is Token {
  return isText(node) && node.data?.token !== undefined;
}

export function parseTokens(root: Root): Root {
  const fragment = parseNode(root);
  const result = fragment.children[0];
  return result as Root;
}
