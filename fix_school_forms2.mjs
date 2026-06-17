
import fs from "fs";
import path from "path";

const dir = "src/pages/school";
const files = fs.readdirSync(dir).filter(f => f.endsWith(".tsx"));

for (const file of files) {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, "utf8");
  
  // Find load functions and replace the toast error back to silent return
  content = content.replace(
    /(const load[A-Za-z]+ = async \(\) => \{\s*if \(!businessId\)) \{ toast\.error\("Erreur de session \(businessId manquant\)"\); return; \}/g,
    "$1 return;"
  );
  
  fs.writeFileSync(filePath, content);
}
console.log("Done fixing school load functions!");
