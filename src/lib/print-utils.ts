import jsPDF from "jspdf";
import html2canvas from "html2canvas";

export function getTodayFr(): string {
  return new Date().toLocaleDateString("fr-FR", {
    day: "2-digit", month: "long", year: "numeric",
  });
}

export function getTimeFr(): string {
  return new Date().toLocaleTimeString("fr-FR", {
    hour: "2-digit", minute: "2-digit",
  });
}

export async function printReceipt(element: HTMLElement, fileName = "recu"): Promise<void> {
  try {
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);

    const style = document.createElement("style");
    style.textContent = `
      @page { width: 80mm; margin: 0; padding: 0; }
      body { font-family: monospace; font-size: 11px; width: 80mm; margin: 0 auto; padding: 0; }
      img { max-width: 100%; }
      .text-black { color: #000; }
      .text-center { text-align: center; }
      .font-bold { font-weight: bold; }
      .uppercase { text-transform: uppercase; }
      .truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .flex { display: flex; }
      .justify-between { justify-content: space-between; }
      .items-center { align-items: center; }
    `;

    const cloned = element.cloneNode(true) as HTMLElement;
    cloned.style.width = "80mm";
    cloned.style.padding = "3mm";
    cloned.style.margin = "0";
    cloned.style.background = "#fff";

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      window.print();
      return;
    }

    doc.open();
    doc.write("<!DOCTYPE html><html><head><meta charset='utf-8'>");
    doc.write(style.outerHTML);
    doc.write("</head><body>");
    doc.write(cloned.outerHTML);
    doc.write("</body></html>");
    doc.close();

    iframe.contentWindow?.focus();
    
    // Attendre que le contenu soit rendu (important pour les images/styles)
    setTimeout(() => {
      iframe.contentWindow?.print();
      // Nettoyer après l'impression
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 1000);
    }, 250);
  } catch (e) {
    console.error("Erreur d'impression:", e);
    window.print();
  }
}

export async function printA4(element: HTMLElement, fileName = "document"): Promise<void> {
  try {
    const canvas = await html2canvas(element, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
    });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const imgWidth = pageWidth - 20;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;
    let position = 10;
    pdf.addImage(imgData, "PNG", 10, position, imgWidth, imgHeight);
    heightLeft -= pdf.internal.pageSize.getHeight() - 20;
    while (heightLeft > 0) {
      position = heightLeft - imgHeight + 10;
      pdf.addPage();
      pdf.addImage(imgData, "PNG", 10, position, imgWidth, imgHeight);
      heightLeft -= pdf.internal.pageSize.getHeight() - 20;
    }
    pdf.save(`${fileName}-${Date.now()}.pdf`);
  } catch {
    window.print();
  }
}

export async function printInvoice(element: HTMLElement, fileName = "facture"): Promise<void> {
  await printA4(element, fileName);
}

export async function printReport(element: HTMLElement, fileName = "rapport"): Promise<void> {
  await printA4(element, fileName);
}
