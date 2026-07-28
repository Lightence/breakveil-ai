import { useEffect, useMemo, useState } from "react";

import {
  CheckCircle2,
  Download,
  ExternalLink,
  FileText,
  Library,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

import {
  BorderStyle,
  Document,
  Packer,
  Paragraph,
  TextRun,
} from "docx";

import {
  PDFDocument,
  StandardFonts,
  rgb,
} from "pdf-lib";

export const coverLetterFormatStorageKey =
  "jobpilot.cover-letter-format";

function clean(value) {
  return String(value || "").trim();
}

function safeFilePart(value, fallback = "Document") {
  const cleaned = clean(value)
    // Deliberately remove Windows-reserved control characters from filenames.
    // eslint-disable-next-line no-control-regex
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "")
    .replace(/\s+/g, " ")
    .replace(/\.+$/g, "")
    .trim();

  return (cleaned || fallback).slice(0, 70);
}

function normalisePdfText(value) {
  return String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2022/g, "-")
    // Keep printable PDF text plus tab and line-break characters.
    // eslint-disable-next-line no-control-regex
    .replace(/[^\x09\x0A\x0D\x20-\x7E\u00A3]/g, "");
}

function splitParagraphs(value) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function getCandidateName(profile) {
  return (
    clean(profile?.preferredName) ||
    clean(profile?.fullName) ||
    "Candidate"
  );
}

function getCandidateContact(profile) {
  return [
    clean(profile?.email),
    clean(profile?.phone),
    clean(profile?.location) ||
      clean(profile?.town) ||
      clean(profile?.city),
    clean(profile?.linkedin),
  ].filter(Boolean);
}

function formatCurrentDate() {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());
}

function getGeneratedKey(vacancy, workspaceId) {
  const explicitKey = clean(workspaceId);

  if (explicitKey) {
    return explicitKey;
  }

  return [
    clean(vacancy?.jobUrl),
    clean(vacancy?.liveSearchId),
    clean(vacancy?.role),
    clean(vacancy?.company),
    clean(vacancy?.location),
  ]
    .filter(Boolean)
    .join("|")
    .toLowerCase();
}

function buildFilename({ profile, vacancy, extension }) {
  const candidate = safeFilePart(
    getCandidateName(profile),
    "Candidate",
  );

  const role = safeFilePart(
    vacancy?.role,
    "Application",
  );

  const company = safeFilePart(
    vacancy?.company,
    "Company",
  );

  return `${candidate} - Cover Letter - ${role} - ${company}.${extension}`;
}

function downloadBlob(blob, filename) {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.style.display = "none";

  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  window.setTimeout(() => {
    URL.revokeObjectURL(objectUrl);
  }, 1500);
}

function createWordParagraphs(text) {
  return splitParagraphs(text).map(
    (paragraph) =>
      new Paragraph({
        children: [
          new TextRun({
            text: paragraph,
            font: "Aptos",
            size: 22,
            color: "222222",
          }),
        ],
        spacing: {
          after: 190,
          line: 286,
        },
      }),
  );
}

async function createWordDocument({
  coverLetter,
  profile,
  vacancy,
}) {
  const candidateName =
    getCandidateName(profile);

  const contactDetails =
    getCandidateContact(profile);

  const company =
    clean(vacancy?.company);

  const role =
    clean(vacancy?.role);

  const headerChildren = [
    new Paragraph({
      children: [
        new TextRun({
          text: candidateName,
          bold: true,
          font: "Aptos Display",
          size: 38,
          color: "171717",
        }),
      ],
      spacing: {
        after: 70,
      },
    }),
  ];

  if (contactDetails.length > 0) {
    headerChildren.push(
      new Paragraph({
        children: [
          new TextRun({
            text: contactDetails.join(
              "  |  ",
            ),
            font: "Aptos",
            size: 19,
            color: "525252",
          }),
        ],
        border: {
          bottom: {
            style:
              BorderStyle.SINGLE,
            color: "D4D4D4",
            size: 6,
            space: 8,
          },
        },
        spacing: {
          after: 280,
        },
      }),
    );
  } else {
    headerChildren.push(
      new Paragraph({
        border: {
          bottom: {
            style:
              BorderStyle.SINGLE,
            color: "D4D4D4",
            size: 6,
            space: 8,
          },
        },
        spacing: {
          after: 280,
        },
      }),
    );
  }

  const metaChildren = [
    new Paragraph({
      children: [
        new TextRun({
          text: formatCurrentDate(),
          font: "Aptos",
          size: 21,
          color: "404040",
        }),
      ],
      spacing: {
        after: 150,
      },
    }),
  ];

  if (company) {
    metaChildren.push(
      new Paragraph({
        children: [
          new TextRun({
            text: company,
            bold: true,
            font: "Aptos",
            size: 22,
            color: "262626",
          }),
        ],
        spacing: {
          after: 80,
        },
      }),
    );
  }

  if (role) {
    metaChildren.push(
      new Paragraph({
        children: [
          new TextRun({
            text:
              `Re: Application for ${role}`,
            bold: true,
            font: "Aptos",
            size: 22,
            color: "262626",
          }),
        ],
        spacing: {
          before: 120,
          after: 260,
        },
      }),
    );
  }

  const document = new Document({
    creator: candidateName,

    title: role
      ? `Cover Letter - ${role}`
      : "Cover Letter",

    description: company
      ? `Tailored cover letter for ${company}`
      : "Tailored cover letter",

    styles: {
      default: {
        document: {
          run: {
            font: "Aptos",
            size: 22,
            color: "222222",
          },
          paragraph: {
            spacing: {
              line: 286,
              after: 190,
            },
          },
        },
      },
    },

    sections: [
      {
        properties: {
          page: {
            size: {
              width: 11906,
              height: 16838,
            },
            margin: {
              top: 1000,
              right: 1134,
              bottom: 1000,
              left: 1134,
            },
          },
        },

        children: [
          ...headerChildren,
          ...metaChildren,
          ...createWordParagraphs(
            coverLetter,
          ),
        ],
      },
    ],
  });

  return Packer.toBlob(document);
}

function wrapPdfText(
  text,
  font,
  size,
  maxWidth,
) {
  const words =
    normalisePdfText(text)
      .split(/\s+/)
      .filter(Boolean);

  const lines = [];
  let line = "";

  for (const word of words) {
    const candidate =
      line
        ? `${line} ${word}`
        : word;

    const width =
      font.widthOfTextAtSize(
        candidate,
        size,
      );

    if (
      width <= maxWidth ||
      !line
    ) {
      line = candidate;
    } else {
      lines.push(line);
      line = word;
    }
  }

  if (line) {
    lines.push(line);
  }

  return lines;
}

async function createPdfDocument({
  coverLetter,
  profile,
  vacancy,
}) {
  const pdf =
    await PDFDocument.create();

  const regularFont =
    await pdf.embedFont(
      StandardFonts.Helvetica,
    );

  const boldFont =
    await pdf.embedFont(
      StandardFonts.HelveticaBold,
    );

  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const marginX = 62;
  const topMargin = 58;
  const bottomMargin = 58;

  const bodyWidth =
    pageWidth -
    marginX * 2;

  let page =
    pdf.addPage([
      pageWidth,
      pageHeight,
    ]);

  let y =
    pageHeight -
    topMargin;

  function addPage() {
    page =
      pdf.addPage([
        pageWidth,
        pageHeight,
      ]);

    y =
      pageHeight -
      topMargin;
  }

  function ensureSpace(
    requiredHeight,
  ) {
    if (
      y -
        requiredHeight <
      bottomMargin
    ) {
      addPage();
    }
  }

  function drawLine(
    text,
    options = {},
  ) {
    const {
      font = regularFont,
      size = 11,
      colour = rgb(
        0.14,
        0.14,
        0.14,
      ),
      gapAfter = 0,
      x = marginX,
    } = options;

    ensureSpace(
      size +
        gapAfter +
        4,
    );

    page.drawText(
      normalisePdfText(
        text,
      ),
      {
        x,
        y,
        size,
        font,
        color: colour,
      },
    );

    y -=
      size +
      gapAfter;
  }

  function drawWrappedParagraph(
    text,
    options = {},
  ) {
    const {
      font = regularFont,
      size = 11,
      lineHeight = 16,
      gapAfter = 9,
      colour = rgb(
        0.14,
        0.14,
        0.14,
      ),
    } = options;

    const lines =
      wrapPdfText(
        text,
        font,
        size,
        bodyWidth,
      );

    for (const line of lines) {
      ensureSpace(
        lineHeight,
      );

      page.drawText(
        line,
        {
          x: marginX,
          y,
          size,
          font,
          color: colour,
        },
      );

      y -=
        lineHeight;
    }

    y -= gapAfter;
  }

  const candidateName =
    getCandidateName(profile);

  const contactDetails =
    getCandidateContact(profile);

  const company =
    clean(vacancy?.company);

  const role =
    clean(vacancy?.role);

  drawLine(
    candidateName,
    {
      font: boldFont,
      size: 18,
      colour: rgb(
        0.07,
        0.07,
        0.07,
      ),
      gapAfter: 8,
    },
  );

  if (
    contactDetails.length >
    0
  ) {
    drawWrappedParagraph(
      contactDetails.join(
        "  |  ",
      ),
      {
        size: 9.5,
        lineHeight: 13,
        gapAfter: 5,
        colour: rgb(
          0.34,
          0.34,
          0.34,
        ),
      },
    );
  }

  page.drawLine({
    start: {
      x: marginX,
      y: y + 2,
    },
    end: {
      x:
        pageWidth -
        marginX,
      y: y + 2,
    },
    thickness: 0.8,
    color: rgb(
      0.78,
      0.78,
      0.78,
    ),
  });

  y -= 24;

  drawLine(
    formatCurrentDate(),
    {
      size: 10.5,
      gapAfter: 8,
      colour: rgb(
        0.28,
        0.28,
        0.28,
      ),
    },
  );

  if (company) {
    drawLine(
      company,
      {
        font: boldFont,
        size: 11,
        gapAfter: 4,
      },
    );
  }

  if (role) {
    y -= 8;

    drawWrappedParagraph(
      `Re: Application for ${role}`,
      {
        font: boldFont,
        size: 11,
        lineHeight: 15,
        gapAfter: 12,
      },
    );
  } else {
    y -= 8;
  }

  for (
    const paragraph
    of splitParagraphs(
      coverLetter,
    )
  ) {
    drawWrappedParagraph(
      paragraph,
      {
        size: 11,
        lineHeight: 16,
        gapAfter: 9,
      },
    );
  }

  pdf.setTitle(
    role
      ? `Cover Letter - ${role}`
      : "Cover Letter",
  );

  pdf.setAuthor(
    candidateName,
  );

  pdf.setSubject(
    company
      ? `Application to ${company}`
      : "Job application",
  );

  pdf.setCreator(
    "BreakVeil AI",
  );

  const bytes =
    await pdf.save();

  return new Blob(
    [bytes],
    {
      type:
        "application/pdf",
    },
  );
}

function blobToBase64(blob) {
  return new Promise(
    (
      resolve,
      reject,
    ) => {
      const reader =
        new FileReader();

      reader.onload = () => {
        const result =
          String(
            reader.result ||
              "",
          );

        const commaIndex =
          result.indexOf(
            ",",
          );

        resolve(
          commaIndex >= 0
            ? result.slice(
                commaIndex +
                  1,
              )
            : result,
        );
      };

      reader.onerror = () => {
        reject(
          new Error(
            "BreakVeil could not read the generated document.",
          ),
        );
      };

      reader.readAsDataURL(
        blob,
      );
    },
  );
}

async function createCoverLetterBlob({
  format,
  coverLetter,
  candidateProfile,
  vacancy,
}) {
  const values = {
    coverLetter,
    profile:
      candidateProfile ||
      {},
    vacancy:
      vacancy ||
      {},
  };

  if (
    format ===
    "pdf"
  ) {
    return createPdfDocument(
      values,
    );
  }

  return createWordDocument(
    values,
  );
}

export function getCoverLetterFormatPreference() {
  try {
    const value =
      localStorage.getItem(
        coverLetterFormatStorageKey,
      );

    return value ===
      "pdf"
      ? "pdf"
      : "docx";
  } catch {
    return "docx";
  }
}

export function setCoverLetterFormatPreference(
  format,
) {
  const safeFormat =
    format === "pdf"
      ? "pdf"
      : "docx";

  try {
    localStorage.setItem(
      coverLetterFormatStorageKey,
      safeFormat,
    );
  } catch {
    // The preference is optional.
  }

  return safeFormat;
}

export async function saveGeneratedCoverLetterToLibrary({
  coverLetter,
  candidateProfile,
  vacancy,
  workspaceId,
  sourceJobId = "",
  format = getCoverLetterFormatPreference(),
}) {
  if (
    !window.jobPilot
      ?.documents
      ?.saveGenerated
  ) {
    throw new Error(
      "Generated document storage is unavailable. Fully restart BreakVeil after replacing main.cjs and preload.cjs.",
    );
  }

  if (
    clean(
      coverLetter,
    ).length <
    20
  ) {
    throw new Error(
      "Add more cover-letter text before saving it to the Resume Library.",
    );
  }

  const safeFormat =
    format === "pdf"
      ? "pdf"
      : "docx";

  const generatedKey =
    getGeneratedKey(
      vacancy,
      workspaceId,
    );

  if (!generatedKey) {
    throw new Error(
      "BreakVeil could not identify this vacancy.",
    );
  }

  const blob =
    await createCoverLetterBlob({
      format:
        safeFormat,
      coverLetter,
      candidateProfile,
      vacancy,
    });

  const base64 =
    await blobToBase64(
      blob,
    );

  const fileName =
    buildFilename({
      profile:
        candidateProfile ||
        {},
      vacancy:
        vacancy ||
        {},
      extension:
        safeFormat,
    });

  const result =
    await window.jobPilot
      .documents
      .saveGenerated({
        format:
          safeFormat,

        base64,
        fileName,

        generatedKey,

        sourceJobId:
          clean(
            sourceJobId,
          ),

        sourceJobRole:
          clean(
            vacancy?.role,
          ),

        sourceCompany:
          clean(
            vacancy?.company,
          ),

        sourceJobUrl:
          clean(
            vacancy?.jobUrl,
          ),

        assistantWorkspaceId:
          clean(
            workspaceId,
          ) ||
          generatedKey,
      });

  if (!result?.ok) {
    throw new Error(
      result?.error ||
        "BreakVeil could not save the generated cover letter.",
    );
  }

  return {
    document:
      result.document,

    replaced:
      Boolean(
        result.replaced,
      ),

    format:
      safeFormat,
  };
}

export default function CoverLetterExport({
  coverLetter,
  candidateProfile,
  vacancy,
  workspaceId = "",
  sourceJobId = "",
  onSaved,
  onMessage,
}) {
  const [
    exportingFormat,
    setExportingFormat,
  ] = useState("");

  const [
    savingToLibrary,
    setSavingToLibrary,
  ] = useState(false);

  const [
    lastExport,
    setLastExport,
  ] = useState(null);

  const [
    savedDocument,
    setSavedDocument,
  ] = useState(null);

  const [
    format,
    setFormat,
  ] = useState(
    getCoverLetterFormatPreference,
  );

  const generatedKey =
    useMemo(
      () =>
        getGeneratedKey(
          vacancy,
          workspaceId,
        ),
      [
        workspaceId,
        vacancy?.jobUrl,
        vacancy?.liveSearchId,
        vacancy?.role,
        vacancy?.company,
        vacancy?.location,
      ],
    );

  const filenames =
    useMemo(
      () => ({
        word:
          buildFilename({
            profile:
              candidateProfile,
            vacancy,
            extension:
              "docx",
          }),

        pdf:
          buildFilename({
            profile:
              candidateProfile,
            vacancy,
            extension:
              "pdf",
          }),
      }),
      [
        candidateProfile?.preferredName,
        candidateProfile?.fullName,
        vacancy?.role,
        vacancy?.company,
      ],
    );

  const hasContent =
    clean(
      coverLetter,
    ).length >=
    20;

  useEffect(() => {
    let cancelled = false;

    async function loadSavedDocument() {
      if (
        !generatedKey ||
        !window.jobPilot
          ?.documents
          ?.list
      ) {
        setSavedDocument(
          null,
        );

        return;
      }

      try {
        const documents =
          await window.jobPilot
            .documents
            .list();

        if (cancelled) {
          return;
        }

        const existing =
          Array.isArray(
            documents,
          )
            ? documents.find(
                (document) =>
                  [
                    "JobPilot",
                    "BreakVeil",
                  ].includes(
                    document.generatedBy,
                  ) &&
                  document.generatedKind ===
                    "cover-letter" &&
                  document.generatedKey ===
                    generatedKey,
              )
            : null;

        setSavedDocument(
          existing ||
            null,
        );

        if (
          existing
            ?.generatedFormat
        ) {
          setFormat(
            setCoverLetterFormatPreference(
              existing.generatedFormat,
            ),
          );
        }
      } catch {
        if (!cancelled) {
          setSavedDocument(
            null,
          );
        }
      }
    }

    loadSavedDocument();

    return () => {
      cancelled = true;
    };
  }, [generatedKey]);

  function changeFormat(
    nextFormat,
  ) {
    const safeFormat =
      setCoverLetterFormatPreference(
        nextFormat,
      );

    setFormat(
      safeFormat,
    );
  }

  async function exportDocument(
    selectedFormat,
  ) {
    if (
      !hasContent ||
      exportingFormat ||
      savingToLibrary
    ) {
      return;
    }

    setExportingFormat(
      selectedFormat,
    );

    try {
      const blob =
        await createCoverLetterBlob({
          format:
            selectedFormat,
          coverLetter,
          candidateProfile,
          vacancy,
        });

      const filename =
        selectedFormat ===
        "pdf"
          ? filenames.pdf
          : filenames.word;

      downloadBlob(
        blob,
        filename,
      );

      setLastExport({
        format:
          selectedFormat,

        filename,

        exportedAt:
          new Date()
            .toISOString(),
      });

      onMessage?.(
        `${selectedFormat === "pdf" ? "PDF" : "Word"} cover letter exported.`,
      );
    } catch (error) {
      onMessage?.(
        error?.message ||
          `BreakVeil could not create the ${selectedFormat === "pdf" ? "PDF" : "Word"} cover letter.`,
      );
    } finally {
      setExportingFormat(
        "",
      );
    }
  }

  async function saveToLibrary() {
    if (
      !hasContent ||
      savingToLibrary ||
      exportingFormat
    ) {
      return;
    }

    setSavingToLibrary(
      true,
    );

    try {
      const result =
        await saveGeneratedCoverLetterToLibrary({
          coverLetter,
          candidateProfile,
          vacancy,
          workspaceId,
          sourceJobId,
          format,
        });

      setSavedDocument(
        result.document,
      );

      onSaved?.(
        result.document,
      );

      onMessage?.(
        result.replaced
          ? `The generated ${format === "pdf" ? "PDF" : "Word"} cover letter was updated safely in the Resume Library.`
          : `The generated ${format === "pdf" ? "PDF" : "Word"} cover letter was saved to the Resume Library.`,
      );
    } catch (error) {
      onMessage?.(
        error?.message ||
          "BreakVeil could not save the generated cover letter.",
      );
    } finally {
      setSavingToLibrary(
        false,
      );
    }
  }

  async function openSavedDocument() {
    if (
      !savedDocument?.id ||
      !window.jobPilot
        ?.documents
        ?.open
    ) {
      return;
    }

    const result =
      await window.jobPilot
        .documents
        .open(
          savedDocument.id,
        );

    if (!result?.ok) {
      onMessage?.(
        result?.error ||
          "Windows could not open the generated cover letter.",
      );
    }
  }

  return (
    <section className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-5">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-sky-500/20 bg-sky-500/10 text-sky-300">
            <FileText
              size={19}
            />
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold text-zinc-100">
                Generated cover-letter document
              </h3>

              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-300">
                <ShieldCheck
                  size={12}
                />

                Stored locally
              </span>
            </div>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
              Save the latest edited letter directly into the Resume Library.
              Sending this application to the Review Queue also saves or
              updates it automatically.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={
              !hasContent ||
              Boolean(
                exportingFormat,
              ) ||
              savingToLibrary
            }
            onClick={
              saveToLibrary
            }
            className="flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
          >
            {savingToLibrary ? (
              <LoaderCircle
                size={16}
                className="animate-spin"
              />
            ) : savedDocument ? (
              <RefreshCw
                size={16}
              />
            ) : (
              <Library
                size={16}
              />
            )}

            {savingToLibrary
              ? "Saving to Library"
              : savedDocument
                ? "Update Library copy"
                : "Save to Resume Library"}
          </button>

          {savedDocument && (
            <button
              type="button"
              onClick={
                openSavedDocument
              }
              className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-2.5 text-sm font-medium text-emerald-200 transition hover:bg-emerald-500/20"
            >
              <ExternalLink
                size={16}
              />

              Open saved file
            </button>
          )}
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-zinc-800 bg-zinc-950/40 p-5 text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
          Preferred attachment format
        </p>

        <div className="mt-3 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() =>
              changeFormat(
                "docx",
              )
            }
            className={[
              "rounded-lg border px-4 py-2.5 text-sm transition",

              format === "docx"
                ? "border-sky-500/30 bg-sky-500/10 text-sky-200"
                : "border-zinc-700 text-zinc-400 hover:bg-zinc-800",
            ].join(" ")}
          >
            Word (.docx)
          </button>

          <button
            type="button"
            onClick={() =>
              changeFormat(
                "pdf",
              )
            }
            className={[
              "rounded-lg border px-4 py-2.5 text-sm transition",

              format === "pdf"
                ? "border-sky-500/30 bg-sky-500/10 text-sky-200"
                : "border-zinc-700 text-zinc-400 hover:bg-zinc-800",
            ].join(" ")}
          >
            PDF (.pdf)
          </button>
        </div>

        <p className="mx-auto mt-3 max-w-2xl break-words text-xs leading-5 text-zinc-600">
          Current filename:{" "}
          {format === "pdf"
            ? filenames.pdf
            : filenames.word}
        </p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={
            !hasContent ||
            Boolean(
              exportingFormat,
            ) ||
            savingToLibrary
          }
          onClick={() =>
            exportDocument(
              "docx",
            )
          }
          className="flex items-center gap-2 rounded-lg border border-zinc-700 px-4 py-2.5 text-sm text-zinc-300 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {exportingFormat ===
          "docx" ? (
            <LoaderCircle
              size={16}
              className="animate-spin"
            />
          ) : (
            <Download
              size={16}
            />
          )}

          Download Word backup
        </button>

        <button
          type="button"
          disabled={
            !hasContent ||
            Boolean(
              exportingFormat,
            ) ||
            savingToLibrary
          }
          onClick={() =>
            exportDocument(
              "pdf",
            )
          }
          className="flex items-center gap-2 rounded-lg border border-zinc-700 px-4 py-2.5 text-sm text-zinc-300 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {exportingFormat ===
          "pdf" ? (
            <LoaderCircle
              size={16}
              className="animate-spin"
            />
          ) : (
            <Download
              size={16}
            />
          )}

          Download PDF backup
        </button>
      </div>

      {savedDocument && (
        <div className="mt-4 flex items-start gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3">
          <CheckCircle2
            size={17}
            className="mt-0.5 shrink-0 text-emerald-300"
          />

          <div>
            <p className="text-sm font-medium text-emerald-200">
              Resume Library copy ready
            </p>

            <p className="mt-1 break-words text-xs leading-5 text-emerald-200/70">
              {savedDocument.originalName ||
                savedDocument.title}
            </p>

            <p className="mt-1 text-xs text-emerald-200/60">
              Saving again replaces this generated file safely while keeping
              the same Library reference.
            </p>
          </div>
        </div>
      )}

      {lastExport && (
        <div className="mt-4 flex items-start gap-3 rounded-lg border border-zinc-700 bg-zinc-900/70 px-4 py-3">
          <CheckCircle2
            size={17}
            className="mt-0.5 shrink-0 text-zinc-300"
          />

          <div>
            <p className="text-sm font-medium text-zinc-300">
              Backup downloaded
            </p>

            <p className="mt-1 break-words text-xs leading-5 text-zinc-500">
              {lastExport.filename}
            </p>
          </div>
        </div>
      )}

      {!hasContent && (
        <p className="mt-4 text-xs text-amber-300">
          Add more cover-letter text before creating a document.
        </p>
      )}
    </section>
  );
}
