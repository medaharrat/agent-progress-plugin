import { realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";

/** True when this module was invoked directly (`node file.js`), including through a symlink. Node resolves
 * import.meta.url to the real path but leaves process.argv[1] as given, so both sides must be canonicalized. */
export function isMainModule(moduleUrl: string): boolean {
  if (!process.argv[1]) return false;
  try { return moduleUrl === pathToFileURL(realpathSync(process.argv[1])).href; }
  catch { return false; }
}
