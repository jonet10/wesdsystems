
import fs from "fs";
import path from "path";

const dir = "supabase/migrations";
const files = fs.readdirSync(dir).filter(f => f.endsWith(".sql"));

for (const file of files) {
  const filePath = path.join(dir, file);
  const content = fs.readFileSync(filePath, "utf8");
  if (content.includes("CREATE TABLE public.school_students")) {
    console.log("Found in " + file);
    const lines = content.split("\n");
    let inTable = false;
    for (const line of lines) {
      if (line.includes("CREATE TABLE public.school_students")) {
        inTable = true;
      }
      if (inTable) {
        console.log(line);
        if (line.includes(");")) break;
      }
    }
  }
}
