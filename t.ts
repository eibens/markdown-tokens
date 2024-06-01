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