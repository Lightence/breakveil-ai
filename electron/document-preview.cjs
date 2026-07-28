const fs = require("fs")
const path = require("path")

const mammoth =
  require("mammoth")

const fileSystem =
  fs.promises

const maximumPreviewSize =
  25 * 1024 * 1024

const imageMimeTypes =
  new Set([
    "image/png",
    "image/jpeg",
    "image/gif",
    "image/webp",
    "image/bmp",
  ])

function getExtension(
  document,
  documentPath,
) {
  return String(
    document?.extension ||
      path.extname(
        document?.originalName ||
          documentPath ||
          "",
      ) ||
      "",
  )
    .trim()
    .toLowerCase()
    .replace(
      /^\./,
      "",
    )
}

function cleanRtfText(
  buffer,
) {
  let value =
    buffer.toString(
      "latin1",
    )

  value =
    value.replace(
      /\\'([0-9a-f]{2})/gi,
      (
        _match,
        hexadecimal,
      ) =>
        String.fromCharCode(
          Number.parseInt(
            hexadecimal,
            16,
          ),
        ),
    )

  value =
    value.replace(
      /\\(?:par|line)\b/g,
      "\n",
    )

  value =
    value.replace(
      /\\tab\b/g,
      "\t",
    )

  value =
    value.replace(
      /\\[a-z]+-?\d* ?/gi,
      "",
    )

  value =
    value.replace(
      /\\[{}\\]/g,
      "",
    )

  value =
    value.replace(
      /[{}]/g,
      "",
    )

  return value
    .replace(
      /\r\n?/g,
      "\n",
    )
    .replace(
      /\n{4,}/g,
      "\n\n\n",
    )
    .trim()
}

function getUnsupportedMessage(
  extension,
) {
  if (
    extension === "doc"
  ) {
    return "Older Word .doc files cannot be rendered safely inside BreakVeil. Open this document externally to view or edit it."
  }

  if (
    extension === "odt"
  ) {
    return "OpenDocument previews are not available yet. Open this document externally to preserve its formatting."
  }

  return "This file type does not have an in-app preview. You can still open it with its normal Windows application."
}

function registerDocumentPreview({
  ipcMain,
  resolveDocument,
  getErrorMessage,
}) {
  ipcMain.handle(
    "documents:preview",
    async (
      _event,
      documentId,
    ) => {
      try {
        const {
          document,
          documentPath,
        } =
          await resolveDocument(
            documentId,
          )

        const stats =
          await fileSystem.stat(
            documentPath,
          )

        if (
          stats.size >
          maximumPreviewSize
        ) {
          throw new Error(
            "This document is larger than the 25 MB in-app preview limit. Open it externally instead.",
          )
        }

        const extension =
          getExtension(
            document,
            documentPath,
          )

        const mimeType =
          document.mimeType ||
          ""

        const buffer =
          await fileSystem.readFile(
            documentPath,
          )

        const baseResult = {
          ok: true,

          document: {
            id:
              document.id,

            title:
              document.title ||
              document.originalName ||
              "Document",

            originalName:
              document.originalName ||
              "",

            category:
              document.category ||
              "Other",

            extension,

            mimeType,

            sizeBytes:
              stats.size,
          },
        }

        if (
          extension === "pdf" ||
          mimeType ===
            "application/pdf"
        ) {
          return {
            ...baseResult,

            kind:
              "pdf",

            mimeType:
              "application/pdf",

            base64:
              buffer.toString(
                "base64",
              ),
          }
        }

        if (
          imageMimeTypes.has(
            mimeType,
          ) ||
          [
            "png",
            "jpg",
            "jpeg",
            "gif",
            "webp",
            "bmp",
          ].includes(
            extension,
          )
        ) {
          return {
            ...baseResult,

            kind:
              "image",

            mimeType:
              mimeType ||
              `image/${extension === "jpg" ? "jpeg" : extension}`,

            base64:
              buffer.toString(
                "base64",
              ),
          }
        }

        if (
          [
            "txt",
            "md",
            "csv",
            "log",
          ].includes(
            extension,
          ) ||
          mimeType.startsWith(
            "text/",
          )
        ) {
          return {
            ...baseResult,

            kind:
              "text",

            text:
              buffer.toString(
                "utf8",
              ),
          }
        }

        if (
          extension ===
            "docx"
        ) {
          const result =
            await mammoth
              .extractRawText({
                buffer,
              })

          const text =
            String(
              result?.value ||
                "",
            ).trim()

          return {
            ...baseResult,

            kind:
              "text",

            text:
              text ||
              "BreakVeil could not find readable text inside this Word document.",

            simplified:
              true,

            notice:
              "This is a simplified text preview. Open externally to see the original Word formatting and make edits.",
          }
        }

        if (
          extension ===
            "rtf"
        ) {
          return {
            ...baseResult,

            kind:
              "text",

            text:
              cleanRtfText(
                buffer,
              ),

            simplified:
              true,

            notice:
              "This is a simplified text preview. Open externally to see the original RTF formatting and make edits.",
          }
        }

        return {
          ...baseResult,

          kind:
            "unsupported",

          message:
            getUnsupportedMessage(
              extension,
            ),
        }
      } catch (error) {
        return {
          ok: false,

          error:
            getErrorMessage(
              error,
            ),
        }
      }
    },
  )
}

module.exports = {
  registerDocumentPreview,
}
