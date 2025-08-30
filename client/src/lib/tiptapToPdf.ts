interface TiptapNode {
  type: string;
  content?: TiptapNode[];
  text?: string;
  marks?: { type: string }[];
  attrs?: {
    level?: number;
    textAlign?: string;
    checked?: boolean;
    [key: string]: any;
  };
}

const convertNodeToHtml = (node: TiptapNode): string => {
  if (!node) return '';
  
  // Handle text nodes with marks (bold, italic, etc.)
  if (node.type === 'text') {
    let text = node.text || '';
    if (node.marks) {
      node.marks.forEach(mark => {
        if (mark.type === 'bold') text = `<strong>${text}</strong>`;
        else if (mark.type === 'italic') text = `<em>${text}</em>`;
        else if (mark.type === 'underline') text = `<u>${text}</u>`;
        else if (mark.type === 'strike') text = `<s>${text}</s>`;
      });
    }
    return text;
  }
  
  let html = '';
  let tag = 'div';
  const attrs: string[] = [];
  
  // Map Tiptap node types to HTML tags
  switch (node.type) {
    case 'paragraph':
      tag = 'p';
      break;
    case 'heading':
      tag = `h${node.attrs?.level || 1}`;
      break;
    case 'bulletList':
      tag = 'ul';
      break;
    case 'orderedList':
      tag = 'ol';
      break;
    case 'listItem':
      tag = 'li';
      break;
    case 'taskList':
      tag = 'ul';
      attrs.push('class="task-list"');
      break;
    case 'taskItem':
      tag = 'li';
      attrs.push(`class="task-item ${node.attrs?.checked ? 'checked' : ''}"`);
      break;
    case 'horizontalRule':
      return '<hr />';
    case 'hardBreak':
      return '<br />';
    case 'doc':
      // Handle document node
      if (node.content && Array.isArray(node.content)) {
        return node.content.map(convertNodeToHtml).join('');
      }
      return '';
  }
  
  // Handle text alignment
  if (node.attrs?.textAlign) {
    attrs.push(`style="text-align: ${node.attrs.textAlign}"`);
  }
  
  // Handle task items
  if (node.type === 'taskItem') {
    const checked = node.attrs?.checked ? 'checked' : '';
    html += `<input type="checkbox" ${checked} disabled /> `;
  }
  
  // Open tag with attributes
  html += `<${tag}${attrs.length ? ' ' + attrs.join(' ') : ''}>`;
  
  // Process child nodes
  if (node.content && Array.isArray(node.content)) {
    node.content.forEach(child => {
      html += convertNodeToHtml(child);
    });
  }
  
  // Close tag
  html += `</${tag}>`;
  
  // Add line break after certain block elements
  if (['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'hr', 'div'].includes(tag)) {
    html += '\n';
  }
  
  return html;
};

export const tiptapToHtml = (content: any): string => {
  try {
    // Parse content if it's a string
    let parsedContent = content;
    if (typeof content === 'string') {
      try {
        parsedContent = JSON.parse(content);
      } catch (e) {
        console.error('Failed to parse content:', e);
        return '<p>Error: Invalid content format</p>';
      }
    }
    
    if (!parsedContent) return '<p>No content to export</p>';
    
    // Handle both direct content and nested content structures
    if (parsedContent.type === 'doc' || parsedContent.content) {
      return convertNodeToHtml(parsedContent);
    } else if (Array.isArray(parsedContent)) {
      return parsedContent.map(convertNodeToHtml).join('');
    }
    
    return convertNodeToHtml(parsedContent);
  } catch (error) {
    console.error('Error converting Tiptap content to HTML:', error);
    return '<p>Error converting content to PDF. Please try again.</p>';
  }
};

export const exportAsPdf = (title: string, content: string) => {
  try {
    // Create a new window for printing
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      throw new Error('Could not open print window');
    }
    
    // Write the content with proper styling for print
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title || 'Document'}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Sinhala:wght@400;700&display=swap');
            body {
              font-family: 'Noto Sans Sinhala', Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              padding: 20px;
              max-width: 800px;
              margin: 0 auto;
            }
            h1 {
              text-align: center;
              margin-bottom: 30px;
              color: #1a1a1a;
            }
            img {
              max-width: 100%;
              height: auto;
            }
            @media print {
              @page {
                size: A4;
                margin: 1.5cm;
              }
              body {
                padding: 0;
              }
            }
          </style>
        </head>
        <body>
          <h1>${title || 'Document'}</h1>
          <div class="content">${content}</div>
          <script>
            // Automatically trigger print when the window loads
            window.onload = function() {
              setTimeout(function() {
                window.print();
                // Close the window after printing
                setTimeout(function() {
                  window.close();
                }, 1000);
              }, 500);
            };
          </script>
        </body>
      </html>
    `);
    
    printWindow.document.close();
    return true;
  } catch (error) {
    console.error('Error exporting PDF:', error);
    return false;
  }
};
