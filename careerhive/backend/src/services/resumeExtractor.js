const path = require("path");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");

const SUPPORTED_EXTENSIONS = new Set([".pdf", ".docx", ".txt"]);

function normalizeExtractedText(text) {
  return String(text || "")
    .replace(/\r/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[\t ]{2,}/g, " ")
    .trim();
}

function getFileExtension(fileName) {
  return path.extname(String(fileName || "").toLowerCase());
}

function isPdfType(mimeType, extension) {
  return mimeType === "application/pdf" || extension === ".pdf";
}

function isDocxType(mimeType, extension) {
  return mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || extension === ".docx";
}

async function extractResumeText({ buffer, mimeType, fileName }) {
  const extension = getFileExtension(fileName);

  if (!buffer || !Buffer.isBuffer(buffer) || !buffer.length) {
    throw new Error("Uploaded file is empty.");
  }

  if (!SUPPORTED_EXTENSIONS.has(extension)) {
    throw new Error("Unsupported file type. Please upload a PDF, DOCX, or TXT file.");
  }

  if (isPdfType(mimeType, extension)) {
    const parsed = await pdfParse(buffer);
    return {
      text: normalizeExtractedText(parsed?.text),
      format: "pdf"
    };
  }

  if (isDocxType(mimeType, extension)) {
    const parsed = await mammoth.extractRawText({ buffer });
    return {
      text: normalizeExtractedText(parsed?.value),
      format: "docx"
    };
  }

  if (extension === ".txt") {
    return {
      text: normalizeExtractedText(buffer.toString("utf8")),
      format: "txt"
    };
  }

  throw new Error("Unsupported file type. Please upload a PDF, DOCX, or TXT file.");
}

module.exports = {
  extractResumeText
};
