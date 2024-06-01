import { assertEquals } from "$std/assert/assert_equals.ts";
import { assertThrows } from "$std/assert/assert_throws.ts";
import gfm from "https://esm.sh/remark-gfm@4.0.0";
import remarkParse from "https://esm.sh/remark-parse@11.0.0";
import remarkStringify from "https://esm.sh/remark-stringify@11.0.0";
import { unified } from "https://esm.sh/unified@11.0.4";
import type {
  Node,
  Parent,
  Root,
  Text,
} from "https://esm.sh/v135/@types/mdast@4.0.4/index.d.ts";
import "https://esm.sh/v135/@types/unist@3.0.2/index.d.ts";
import { isToken, parseTokens, Token } from "../markdown-tokens/mod.ts";

/** HELPERS **/

type ExpectedTokens = Partial<{
  root: string[];
  paragraph: string[];
  first: string[];
  second: string[];
  third: string[];
  innerFirst: string[];
  innerSecond: string[];
}>;

type BasicTest = [string, string | null];

type TokensTest = [...BasicTest, ExpectedTokens];

type Test = BasicTest | TokensTest;

function deleteMarkdownPosition(node: Node) {
  delete node.position;
  const hasChildren = "children" in node;
  if (hasChildren) {
    const parent = node as Parent;
    parent.children.forEach((child) => deleteMarkdownPosition(child));
  }
  return true;
}

function parseMarkdown(
  str: string,
): Root {
  const root = unified()
    .use(remarkParse)
    .use(gfm)
    .parse(str) as Root;
  deleteMarkdownPosition(root);
  return root;
}

function stringifyMarkdown(
  root: Root,
) {
  return unified()
    .use(remarkStringify)
    .stringify(root as never)
    .trim();
}

function parse(text: string) {
  return parseTokens(parseMarkdown(text));
}

const tests: Test[] = [
  // text and whitespace
  ["a", "a"],
  ["a ", "a"],
  [" a", "a"],

  // plain token
  [":a:", ":a:"],
  [":a: ", ":a:"],
  [" :a:", ":a:"],
  ["a :b:", "a :b:"],
  [":a: b", ":a: b"],
  ["a :b: c", "a :b: c"],

  // token assignment
  ["a :^b:", "a", { first: ["b"] }],
  [":a^: b", "b", { first: ["a"] }],
  ["a :b^:", "a", { paragraph: ["b"] }],
  [":^a: b", "b", { paragraph: ["a"] }],
  ["a :^b: c", "a c", { first: ["b"] }],
  ["a :b^: c", "a c", { third: ["b"] }],
  ["a:^b:c", "ac", { first: ["b"] }],
  ["a:b^:c", "ac", { second: ["b"] }],

  // empty paragraph
  [":^a:", null, { root: ["a"] }],
  [":a^:", null, { root: ["a"] }],
  [" :^a:", null, { root: ["a"] }],
  [" :a^:", null, { root: ["a"] }],
  [":^a: ", null, { root: ["a"] }],
  [":a^: ", null, { root: ["a"] }],
  [":^a: :^b:", null, { root: ["a", "b"] }],
  [":a^: :b^:", null, { root: ["a", "b"] }],
  [":^a: :b^:", null, { root: ["a", "b"] }],
  [":a^: :^b:", null, { root: ["b", "a"] }],

  // other inline elements
  ["*:a:*", "*:a:*"],
  ["*:^a:*", "**", { first: ["a"] }],
  ["*:a^:*", "**", { first: ["a"] }],
  ["*:^a: b*", "*b*", { first: ["a"] }],
  ["*a :b^:*", "*a*", { first: ["b"] }],
  ["*:a^: b*", "*b*", { innerFirst: ["a"] }],
  ["*a :^b:*", "*a*", { innerFirst: ["b"] }],
  [":a^: *b*", "*b*", { first: ["a"] }],
  ["*a* :^b:", "*a*", { first: ["b"] }],
  ["a :b^: *c*", "a *c*", { third: ["b"] }],
  ["a:b^:*c*", "a*c*", { second: ["b"] }],

  // token on token
  [":a: :^b:", ":a:", { first: ["b"] }],
  [":a^: :b:", ":b:", { first: ["a"] }],
  [":a^: :b: :^c:", ":b:", { first: ["a", "c"] }],

  // no tokens in inline code
  ["`a :^b:`", "`a :^b:`"],

  // not a token
  ["::", "::"],
  [":^:", ":^:"],
  [":^a^:", ":^a^:"],
];

/** MAIN **/

tests.forEach(([input, expected, tokens], i) => {
  const num = String(i + 1).padStart(String(tests.length).length, "0");
  Deno.test(`Markdown test #${num}: ${input} -> ${expected}`, () => {
    const root = parse(input);
    const paragraph = root.children[0] as Parent;

    if (paragraph?.type !== "paragraph") {
      assertEquals(null, expected);
    } else {
      assertEquals(stringifyMarkdown(root), expected);
    }

    if (tokens) {
      const [first, second, third] = paragraph?.children ?? [];
      const [innerFirst, innerSecond] = (first as Parent)?.children ?? [];

      assertEquals(root.data?.tokens, tokens.root);
      assertEquals(paragraph?.data?.tokens, tokens.paragraph);
      assertEquals(first?.data?.tokens, tokens.first);
      assertEquals(second?.data?.tokens, tokens.second);
      assertEquals(third?.data?.tokens, tokens.third);
      assertEquals(innerFirst?.data?.tokens, tokens.innerFirst);
      assertEquals(innerSecond?.data?.tokens, tokens.innerSecond);
    }
  });
});

Deno.test("throws if a text node has pre-existing token", () => {
  assertThrows(() =>
    parseTokens({
      type: "root",
      children: [{
        type: "paragraph",
        children: [{
          type: "text",
          value: "a",
          data: {
            tokens: ["b"],
          },
        }],
      }],
    })
  );
});

Deno.test("token to inline with after", () => {
  const root = parse("a :b^: *c*");
  assertEquals(root, {
    type: "root",
    children: [
      {
        type: "paragraph",
        children: [{
          type: "text",
          value: "a",
        }, {
          type: "text",
          value: " ",
        }, {
          type: "emphasis",
          data: {
            tokens: ["b"],
          },
          children: [
            {
              type: "text",
              value: "c",
            },
          ],
        }],
      },
    ],
  });
});

Deno.test("token to inline with before", () => {
  const root = parse("*a* :^b: c");
  assertEquals(root, {
    type: "root",
    children: [
      {
        type: "paragraph",
        children: [{
          type: "emphasis",
          data: {
            tokens: ["b"],
          },
          children: [
            {
              type: "text",
              value: "a",
            },
          ],
        }, {
          type: "text",
          value: " ",
        }, {
          type: "text",
          value: "c",
        }],
      },
    ],
  });
});

Deno.test("tokens to previous block", () => {
  const root = parse(`a\n\n:^b: :^c:`);
  assertEquals(root, {
    type: "root",
    children: [
      {
        type: "paragraph",
        data: {
          tokens: ["b", "c"],
        },
        children: [
          {
            type: "text",
            value: "a",
          },
        ],
      },
    ],
  });
});

Deno.test("tokens to next block", () => {
  const root = parse(`:a^: :b^:\n\nc`);
  assertEquals(root, {
    type: "root",
    children: [
      {
        type: "paragraph",
        data: {
          tokens: ["a", "b"],
        },
        children: [
          {
            type: "text",
            value: "c",
          },
        ],
      },
    ],
  });
});

Deno.test("markdown thematic break", () => {
  const root = parse(`a\n\n---\n\nb`);
  assertEquals(root, {
    type: "root",
    children: [
      {
        type: "paragraph",
        children: [
          {
            type: "text",
            value: "a",
          },
        ],
      },
      {
        type: "thematicBreak",
      },
      {
        type: "paragraph",
        children: [
          {
            type: "text",
            value: "b",
          },
        ],
      },
    ],
  });
});

Deno.test("isToken returns false for normal text node", () => {
  const node: Text = {
    type: "text",
    value: "a",
  };

  assertEquals(isToken(node), false);
});

Deno.test("isToken returns true for token node", () => {
  const node: Token = {
    type: "text",
    value: ":a:",
    data: { token: "a" },
  };

  assertEquals(isToken(node), true);
});
