import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';

// Register Sinhala font (you'll need to add a Sinhala font file to your public folder)
Font.register({
  family: 'Arial Unicode MS',
  src: '/fonts/arial-unicode-ms.ttf', // You'll need to add this font file
});

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Arial Unicode MS',
  },
  title: {
    fontSize: 24,
    marginBottom: 30,
    textAlign: 'center',
    fontFamily: 'Arial Unicode MS',
  },
  content: {
    fontSize: 12,
    lineHeight: 1.5,
    fontFamily: 'Arial Unicode MS',
  },
  bold: {
    fontWeight: 'bold',
  },
  italic: {
    fontStyle: 'italic',
  },
  underline: {
    textDecoration: 'underline',
  },
});

interface PdfDocumentProps {
  title: string;
  content: any;
}

export function PdfDocument({ title, content }: PdfDocumentProps) {
  const renderContent = (node: any, index: number) => {
    if (!node) return null;

    // Text node
    if (node.text) {
      const style = [styles.content];
      
      if (node.marks) {
        node.marks.forEach((mark: any) => {
          switch (mark.type) {
            case 'bold':
              style.push(styles.bold);
              break;
            case 'italic':
              style.push(styles.italic);
              break;
            case 'underline':
              style.push(styles.underline);
              break;
          }
        });
      }

      return <Text key={index} style={style}>{node.text}</Text>;
    }

    // Paragraph
    if (node.type === 'paragraph') {
      return (
        <View key={index} style={{ marginBottom: 10 }}>
          {node.content?.map((child: any, i: number) => renderContent(child, i))}
        </View>
      );
    }

    // Headings
    if (node.type === 'heading') {
      const level = node.attrs?.level || 1;
      const headingStyle = {
        fontSize: 24 - (level * 2),
        marginTop: 10,
        marginBottom: 5,
        fontWeight: 'bold' as const,
      };

      return (
        <View key={index} style={headingStyle}>
          {node.content?.map((child: any, i: number) => renderContent(child, i))}
        </View>
      );
    }

    // Lists
    if (node.type === 'bulletList' || node.type === 'orderedList') {
      return (
        <View key={index} style={{ marginLeft: 20, marginBottom: 10 }}>
          {node.content?.map((item: any, i: number) => (
            <View key={i} style={{ flexDirection: 'row', marginBottom: 5 }}>
              <Text>{node.type === 'orderedList' ? `${i + 1}. ` : '• '}</Text>
              <View>
                {item.content?.map((child: any, j: number) => renderContent(child, j))}
              </View>
            </View>
          ))}
        </View>
      );
    }

    // Default case for other node types
    if (node.content) {
      return node.content.map((child: any, i: number) => renderContent(child, i));
    }

    return null;
  };

  return (
    <Document>
      <Page style={styles.page}>
        <Text style={styles.title}>{title}</Text>
        <View>
          {content.content?.map((node: any, i: number) => renderContent(node, i))}
        </View>
      </Page>
    </Document>
  );
}
