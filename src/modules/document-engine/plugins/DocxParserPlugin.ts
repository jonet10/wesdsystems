import { DocumentParser, DocumentEngine, DocumentPlugin } from '../core/interfaces';
import { DocumentAST, ASTNode, BlockNode, TextNode, ImageNode, TableNode, TableRowNode, TableCellNode } from '../types/ast';
import mammoth from 'mammoth';
import { GeminiTranslationService } from './geminiTranslationService';

export class DocxParserPlugin implements DocumentPlugin {
  name = 'DocxParserPlugin';
  version = '1.0.0';

  initialize(engine: DocumentEngine): void {
    engine.registerParser(new DocxParser());
  }
}

export class DocxParser implements DocumentParser {
  sourceFormat = 'docx';

  async parse(fileData: ArrayBuffer | Buffer | Blob, apiKey?: string): Promise<DocumentAST> {
    let arrayBuffer: ArrayBuffer;
    
    if (fileData instanceof Blob) {
      arrayBuffer = await fileData.arrayBuffer();
    } else if (fileData instanceof Buffer) {
      arrayBuffer = fileData.buffer.slice(fileData.byteOffset, fileData.byteOffset + fileData.byteLength);
    } else {
      arrayBuffer = fileData;
    }

    // Convert DOCX to HTML using mammoth
    const result = await mammoth.convertToHtml({ arrayBuffer });
    const htmlString = result.value; 

    // Use the Gemini Translation Service
    const finalApiKey = apiKey || import.meta.env.VITE_GEMINI_API_KEY;
    if (!finalApiKey) {
      throw new Error("Clé API Gemini manquante. Veuillez la configurer.");
    }
    
    const translationService = new GeminiTranslationService(finalApiKey);
    const ast = await translationService.translateHtmlToAST(htmlString);
    
    return ast as DocumentAST;
  }
}
