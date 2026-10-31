import { cpSync, copyFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
const root = process.cwd();
const out = join(root, "docs");
for (const name of ["index.html","styles.css","script.js"]) {
  if (!existsSync(join(root,name))) throw new Error("Missing art gallery source: "+name);
}
if (!existsSync(join(root,"artworks"))) throw new Error("Missing artwork images");
if (existsSync(out)) rmSync(out, {recursive:true,force:true});
mkdirSync(out, {recursive:true});
for (const name of ["index.html","styles.css","script.js"]) copyFileSync(join(root,name),join(out,name));
cpSync(join(root,"artworks"), join(out,"artworks"), {recursive:true});
console.log("Sarah Art Gallery built into docs/");
