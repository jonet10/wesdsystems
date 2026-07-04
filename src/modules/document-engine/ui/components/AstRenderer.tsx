import React from 'react';
import { ASTNode, BlockNode, TextNode, VariableNode, ImageNode, TableNode, TableRowNode, TableCellNode, RepeaterNode, ConditionalNode } from '../../types/ast';
import { DataPayload, ConditionRule, Operator } from '../../types/capabilities';

interface AstRendererProps {
  node: ASTNode;
  payload: DataPayload;
  contextIndex?: number; // Used inside repeaters to target the specific row of a collection
  contextItem?: any; // The current item of a collection during a repeater loop
}

export function AstRenderer({ node, payload, contextIndex, contextItem }: AstRendererProps) {
  // --- Style processing ---
  const getStyles = (styleDef?: any): React.CSSProperties => {
    if (!styleDef) return {};
    return {
      fontFamily: styleDef.fontFamily,
      fontSize: styleDef.fontSize ? `${styleDef.fontSize}px` : undefined,
      fontWeight: styleDef.fontWeight,
      fontStyle: styleDef.fontStyle,
      textDecoration: styleDef.textDecoration,
      color: styleDef.color,
      backgroundColor: styleDef.backgroundColor,
      textAlign: styleDef.textAlign as any,
      marginTop: styleDef.marginTop ? `${styleDef.marginTop}px` : undefined,
      marginBottom: styleDef.marginBottom ? `${styleDef.marginBottom}px` : undefined,
      marginLeft: styleDef.marginLeft ? `${styleDef.marginLeft}px` : undefined,
      marginRight: styleDef.marginRight ? `${styleDef.marginRight}px` : undefined,
      paddingTop: styleDef.paddingTop ? `${styleDef.paddingTop}px` : undefined,
      paddingBottom: styleDef.paddingBottom ? `${styleDef.paddingBottom}px` : undefined,
      paddingLeft: styleDef.paddingLeft ? `${styleDef.paddingLeft}px` : undefined,
      paddingRight: styleDef.paddingRight ? `${styleDef.paddingRight}px` : undefined,
      borderWidth: styleDef.borderWidth ? `${styleDef.borderWidth}px` : undefined,
      borderColor: styleDef.borderColor,
      borderStyle: styleDef.borderStyle,
      width: styleDef.width,
      height: styleDef.height,
    };
  };

  const style = getStyles(node.style);

  // --- Evaluation Logic for Conditions ---
  const evaluateCondition = (conditionId: string): boolean => {
    // In a real app, you would look up the ConditionRule by ID from the template metadata
    // For now, assume true unless evaluated
    return true; 
  };

  // --- Render logic based on node type ---
  switch (node.type) {
    case 'document':
      return (
        <div style={style} className="document-root bg-white w-full h-full text-black">
          {(node as BlockNode).children?.map(child => (
            <AstRenderer key={child.id} node={child} payload={payload} />
          ))}
        </div>
      );

    case 'page':
    case 'section':
      return (
        <div style={style} className="page-break-after-always p-8 border-b-2 border-dashed border-gray-200 print:border-none print:p-0">
          {(node as BlockNode).children?.map(child => (
            <AstRenderer key={child.id} node={child} payload={payload} />
          ))}
        </div>
      );

    case 'paragraph':
      return (
        <p style={style} className="mb-2">
          {(node as BlockNode).children?.map(child => (
            <AstRenderer key={child.id} node={child} payload={payload} contextItem={contextItem} />
          ))}
        </p>
      );

    case 'text':
      return <span style={style}>{(node as TextNode).content}</span>;

    case 'variable': {
      const vNode = node as VariableNode;
      // If we are inside a repeater (contextItem exists) and the variable targets the alias
      // e.g., if itemAlias is 'subject' and variableId is 'subject.grade'
      let value = vNode.fallbackValue || `[${vNode.variableId}]`;
      
      if (contextItem) {
        // Very basic resolution for demo: assuming variableId matches the collection schema id directly
        if (contextItem[vNode.variableId] !== undefined) {
          value = String(contextItem[vNode.variableId]);
        }
      } else if (payload.variables[vNode.variableId] !== undefined) {
        value = String(payload.variables[vNode.variableId]);
      }

      return <span style={style} className="print:bg-transparent bg-yellow-100/50">{value}</span>;
    }

    case 'image': {
      const imgNode = node as ImageNode;
      // Basic resolution: check if src is a variable id in payload
      const src = payload.variables[imgNode.src] || imgNode.src;
      return <img src={src} alt={imgNode.alt} style={style} className="max-w-full" />;
    }

    case 'table':
      return (
        <table style={{ ...style, borderCollapse: 'collapse', width: '100%' }} className="mb-4">
          <tbody>
            {(node as BlockNode).children?.map(child => (
              <AstRenderer key={child.id} node={child} payload={payload} />
            ))}
          </tbody>
        </table>
      );

    case 'table_row':
      return (
        <tr style={style}>
          {(node as BlockNode).children?.map(child => (
            <AstRenderer key={child.id} node={child} payload={payload} contextItem={contextItem} />
          ))}
        </tr>
      );

    case 'table_cell':
      return (
        <td style={style} className="border border-gray-800 p-2" colSpan={(node as TableCellNode).colSpan} rowSpan={(node as TableCellNode).rowSpan}>
          {(node as BlockNode).children?.map(child => (
            <AstRenderer key={child.id} node={child} payload={payload} contextItem={contextItem} />
          ))}
        </td>
      );

    case 'repeater': {
      const rNode = node as RepeaterNode;
      const collection = payload.collections[rNode.collectionId];
      if (!collection || !Array.isArray(collection)) return null;

      return (
        <>
          {collection.map((item, index) => (
            <React.Fragment key={`${rNode.id}-${index}`}>
              {rNode.children?.map(child => (
                <AstRenderer key={`${child.id}-${index}`} node={child} payload={payload} contextItem={item} contextIndex={index} />
              ))}
            </React.Fragment>
          ))}
        </>
      );
    }

    case 'conditional': {
      const cNode = node as ConditionalNode;
      if (!evaluateCondition(cNode.conditionId)) return null;
      return (
        <div style={style}>
          {cNode.children?.map(child => (
            <AstRenderer key={child.id} node={child} payload={payload} />
          ))}
        </div>
      );
    }

    default:
      return null;
  }
}
