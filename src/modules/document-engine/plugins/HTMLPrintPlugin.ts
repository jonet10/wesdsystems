import { DocumentPlugin, DocumentEngine, DocumentRenderer } from '../core/interfaces';
import { DocumentAST } from '../types/ast';
import { DataPayload } from '../types/capabilities';
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { AstRenderer } from '../ui/components/AstRenderer';

export class HTMLPrintPlugin implements DocumentPlugin {
  name = 'HTMLPrintPlugin';
  version = '1.0.0';

  initialize(engine: DocumentEngine): void {
    engine.registerRenderer(new HTMLRenderer());
  }
}

class HTMLRenderer implements DocumentRenderer {
  format = 'html';

  async render(ast: DocumentAST, payload: DataPayload): Promise<any> {
    // In a real browser environment, this could return a React Portal or inject into an iframe
    // For now, it returns the React component tree directly so it can be mounted by the consumer (e.g. Grades.tsx)
    return React.createElement(AstRenderer, { node: ast, payload });
  }
}
