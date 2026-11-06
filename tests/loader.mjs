import { isBuiltin } from "node:module";
import { pathToFileURL, fileURLToPath } from "node:url";
import { join } from "node:path";

const rootDir = fileURLToPath(new URL("../", import.meta.url));
const srcDir = join(rootDir, "src");

export async function resolve(specifier, context, nextResolve) {
  if (isBuiltin(specifier)) {
    return nextResolve(specifier, context);
  }

  // Handle @/ alias pointing to src/
  let target = specifier;
  if (target.startsWith("@/")) {
    const relativePath = target.slice(2);
    const absolutePath = join(srcDir, relativePath);
    target = pathToFileURL(absolutePath).href;
  }

  try {
    return await nextResolve(target, context);
  } catch (err) {
    if (err.code === "ERR_MODULE_NOT_FOUND" || err.code === "ERR_UNSUPPORTED_DIR_IMPORT") {
      const candidates = [".ts", ".tsx", ".js", "/index.ts", "/index.js"];
      for (const ext of candidates) {
        try {
          return await nextResolve(target + ext, context);
        } catch {
          // continue checking candidates
        }
      }
    }
    throw err;
  }
}
