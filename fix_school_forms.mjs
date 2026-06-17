
import fs from "fs";
import path from "path";

const dir = "src/pages/school";
const files = fs.readdirSync(dir).filter(f => f.endsWith(".tsx"));

for (const file of files) {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, "utf8");
  
  // Replace silent businessId return
  content = content.replace(
    /if \(!businessId\) return;/g,
    `if (!businessId) { toast.error("Erreur de session (businessId manquant)"); return; }`
  );
  
  // Remove required attributes from Inputs and selects
  content = content.replace(/ required\s*>/g, ">");
  content = content.replace(/ required\s+\/>/g, " />");
  content = content.replace(/ required\s+placeholder=/g, " placeholder=");
  content = content.replace(/ required\s+value=/g, " value=");
  content = content.replace(/ required\s+onChange=/g, " onChange=");
  
  fs.writeFileSync(filePath, content);
}
console.log("Done fixing school forms!");
