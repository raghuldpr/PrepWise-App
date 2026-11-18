// Reads a resume file in the browser. The file itself never leaves the device:
// only the extracted text and the analysis result are sent to the server.
import { itemsToText } from '@prepwise/core';

export const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_PDF_PAGES = 6;

export class ExtractError extends Error {}

async function pdfToText(file) {
  // Loaded on demand so the PDF engine stays out of the main bundle.
  const pdfjs = await import('pdfjs-dist');
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;

  let pdf;
  try {
    pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  } catch (err) {
    if (err?.name === 'PasswordException') throw new ExtractError('This PDF is password protected. Remove the password and try again.');
    throw new ExtractError('This PDF could not be read. It may be damaged; try exporting it again.');
  }
  const pages = [];
  for (let p = 1; p <= Math.min(pdf.numPages, MAX_PDF_PAGES); p++) {
    const content = await (await pdf.getPage(p)).getTextContent();
    pages.push(
      content.items
        .filter((i) => typeof i.str === 'string')
        .map((i) => ({ str: i.str, x: i.transform[4], y: i.transform[5], w: i.width, h: i.height })),
    );
  }
  return itemsToText(pages);
}

async function docxToText(file) {
  const mammoth = (await import('mammoth/mammoth.browser')).default;
  try {
    const { value } = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return value.replace(/\n{3,}/g, '\n\n');
  } catch {
    throw new ExtractError('This Word file could not be read. Save it as .docx (not .doc) and try again.');
  }
}

export async function extractResumeText(file) {
  if (!file) throw new ExtractError('Choose a file first.');
  if (file.size > MAX_FILE_BYTES) throw new ExtractError('The file is larger than 5 MB. Upload a smaller file.');
  const name = file.name.toLowerCase();
  let fileType;
  let text;
  if (name.endsWith('.pdf')) {
    fileType = 'pdf';
    text = await pdfToText(file);
  } else if (name.endsWith('.docx')) {
    fileType = 'docx';
    text = await docxToText(file);
  } else if (name.endsWith('.txt')) {
    fileType = 'txt';
    text = await file.text();
  } else {
    throw new ExtractError('Only PDF, DOCX and TXT files are supported.');
  }
  text = text.replace(/\u0000/g, '').trim();
  if (text.length < 80) {
    throw new ExtractError(
      fileType === 'pdf'
        ? 'No readable text was found. This PDF is probably a scanned image. Export it as a text PDF from Word or Google Docs, or upload a DOCX.'
        : 'The file has almost no text. Check that you chose the right file.',
    );
  }
  return { text: text.slice(0, 60000), fileType };
}
