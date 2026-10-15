import { fileURLToPath } from "node:url";
import { verifyMoghUi } from "./mogh-ui-zh-cn.mjs";

const packageRoot = fileURLToPath(
  new URL("../node_modules/mogh_ui/", import.meta.url),
);
const result = verifyMoghUi(packageRoot);
console.log(
  `Verified mogh_ui@${result.version}: ${result.files} source hashes and ${result.replacements} display replacements.`,
);
