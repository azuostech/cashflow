declare module 'pdf-parse' {
  interface PDFData {
    text: string;
  }

  export default function pdfParse(dataBuffer: Buffer): Promise<PDFData>;
}
