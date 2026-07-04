import { DocumentParser, DocumentEngine, DocumentPlugin } from '../core/interfaces';
import { DocumentAST, ASTNode, BlockNode, TextNode, ImageNode, TableNode, TableRowNode, TableCellNode } from '../types/ast';
import mammoth from 'mammoth';

export class DocxParserPlugin implements DocumentPlugin {
  name = 'DocxParserPlugin';
  version = '1.0.0';

  initialize(engine: DocumentEngine): void {
    engine.registerParser(new DocxParser());
  }
}

export class DocxParser implements DocumentParser {
  sourceFormat = 'docx';

  async parse(fileData: ArrayBuffer | Buffer | Blob): Promise<DocumentAST> {
    let arrayBuffer: ArrayBuffer;
    
    if (fileData instanceof Blob) {
      arrayBuffer = await fileData.arrayBuffer();
    } else if (fileData instanceof Buffer) {
      arrayBuffer = fileData.buffer.slice(fileData.byteOffset, fileData.byteOffset + fileData.byteLength);
    } else {
      arrayBuffer = fileData;
    }

    // Convert DOCX to HTML
    const result = await mammoth.convertToHtml({ arrayBuffer });
    const htmlString = result.value; 

    // Convert HTML to DocumentAST
    const ast = this.htmlToAST(htmlString);
    return ast;
  }

  private htmlToAST(htmlString: string): DocumentAST {
    // Basic DOM Parser in browser
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');
    
    const root: DocumentAST = {
      id: crypto.randomUUID(),
      type: 'document',
      children: []
    };

    const parseNode = (htmlNode: ChildNode): ASTNode | ASTNode[] | null => {
      if (htmlNode.nodeType === Node.TEXT_NODE) {
        const content = htmlNode.textContent;
        if (!content || content.trim() === '') return null;
        
        // Match {{variable_name}}
        const variableRegex = /{{([^}]+)}}/g;
        let match;
        let lastIndex = 0;
        const nodes: ASTNode[] = [];

        while ((match = variableRegex.exec(content)) !== null) {
          // Add preceding text if any
          if (match.index > lastIndex) {
            nodes.push({
              id: crypto.randomUUID(),
              type: 'text',
              content: content.substring(lastIndex, match.index)
            } as TextNode);
          }
          // Add the variable node
          nodes.push({
            id: crypto.randomUUID(),
            type: 'variable',
            variableId: match[1].trim()
          } as VariableNode);
          
          lastIndex = variableRegex.lastIndex;
        }

        // Add remaining text
        if (lastIndex < content.length) {
          nodes.push({
            id: crypto.randomUUID(),
            type: 'text',
            content: content.substring(lastIndex)
          } as TextNode);
        }

        // If only one node was created, return it directly, otherwise return the array
        if (nodes.length === 1) return nodes[0];
        if (nodes.length === 0) return null;
        return nodes;
      }

      if (htmlNode.nodeType === Node.ELEMENT_NODE) {
        const el = htmlNode as HTMLElement;
        const tagName = el.tagName.toLowerCase();
        
        const childrenNodes: ASTNode[] = [];
        el.childNodes.forEach(child => {
          const parsedChild = parseNode(child);
          if (parsedChild) {
            if (Array.isArray(parsedChild)) {
              childrenNodes.push(...parsedChild);
            } else {
              childrenNodes.push(parsedChild);
            }
          }
        });

        if (tagName === 'p' || tagName === 'h1' || tagName === 'h2' || tagName === 'h3') {
          return {
            id: crypto.randomUUID(),
            type: 'paragraph',
            children: childrenNodes,
            style: { 
              fontWeight: tagName.startsWith('h') ? 'bold' : 'normal',
              fontSize: tagName === 'h1' ? '24px' : tagName === 'h2' ? '20px' : '16px',
              textAlign: el.style.textAlign || undefined
            }
          } as BlockNode;
        }

        if (tagName === 'img') {
          const imgEl = el as HTMLImageElement;
          return {
            id: crypto.randomUUID(),
            type: 'image',
            src: imgEl.src,
            alt: imgEl.alt
          } as ImageNode;
        }

        if (tagName === 'table') {
          return {
            id: crypto.randomUUID(),
            type: 'table',
            columnsCount: 1, 
            children: childrenNodes
          } as TableNode;
        }

        if (tagName === 'tr') {
          return {
            id: crypto.randomUUID(),
            type: 'table_row',
            children: childrenNodes
          } as TableRowNode;
        }

        if (tagName === 'td' || tagName === 'th') {
          return {
            id: crypto.randomUUID(),
            type: 'table_cell',
            children: childrenNodes
          } as TableCellNode;
        }

        if (childrenNodes.length > 0) {
           return {
             id: crypto.randomUUID(),
             type: 'section',
             children: childrenNodes
           } as BlockNode;
        }
      }
      return null;
    };

    doc.body.childNodes.forEach(child => {
      const parsed = parseNode(child);
      if (parsed) {
        if (Array.isArray(parsed)) {
          root.children.push(...parsed);
        } else {
          root.children.push(parsed);
        }
      }
    });

    return root;
  }
}
