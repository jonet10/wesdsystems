import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./lib/i18n"; // Import i18n

// Patch for React + Google Translate conflict (NotFoundError: Failed to execute 'removeChild' on 'Node')
if (typeof window !== "undefined") {
  const originalRemoveChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function (child) {
    if (child.parentNode !== this) {
      if (console) console.warn("Google Translate React Fix: Cannot remove a child from a different parent", child, this);
      return child;
    }
    return originalRemoveChild.apply(this, arguments as any);
  };
  
  const originalInsertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function (newNode, referenceNode) {
    if (referenceNode && referenceNode.parentNode !== this) {
      if (console) console.warn("Google Translate React Fix: Cannot insert before a reference node from a different parent", referenceNode, this);
      return newNode;
    }
    return originalInsertBefore.apply(this, arguments as any);
  };
}

createRoot(document.getElementById("root")!).render(<App />);
