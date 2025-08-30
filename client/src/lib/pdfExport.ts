export function exportPageAsPDF(title: string, content: string) {
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
}
