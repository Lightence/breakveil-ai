import {
  useEffect,
  useMemo,
  useState,
} from "react"

import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Eye,
  FileCheck2,
  FileText,
  RefreshCw,
  Search,
  Sparkles,
  Star,
  Trash2,
  Upload,
  X,
} from "lucide-react"

const categories = [
  "CV",
  "Cover Letter",
  "Certificate",
  "Other",
]

const categoryDescriptions = {
  CV:
    "Used as the main CV attachment for applications.",

  "Cover Letter":
    "Reusable or job-specific cover-letter documents.",

  Certificate:
    "Qualifications, training and supporting evidence.",

  Other:
    "Additional documents you may need during recruitment.",
}

export default function ResumeLibrary() {
  const [
    documents,
    setDocuments,
  ] = useState([])

  const [
    search,
    setSearch,
  ] = useState("")

  const [
    categoryFilter,
    setCategoryFilter,
  ] = useState("All")

  const [
    importCategory,
    setImportCategory,
  ] = useState("CV")

  const [
    showImportWindow,
    setShowImportWindow,
  ] = useState(false)

  const [
    isImporting,
    setIsImporting,
  ] = useState(false)

  const [
    isLoading,
    setIsLoading,
  ] = useState(true)

  const [
    settingDefaultId,
    setSettingDefaultId,
  ] = useState("")

  const [
    deleteTarget,
    setDeleteTarget,
  ] = useState(null)

  const [
    isDeleting,
    setIsDeleting,
  ] = useState(false)

  const [
    error,
    setError,
  ] = useState("")

  const [
    message,
    setMessage,
  ] = useState("")

  const [
    previewTarget,
    setPreviewTarget,
  ] = useState(null)

  const [
    previewData,
    setPreviewData,
  ] = useState(null)

  const [
    previewUrl,
    setPreviewUrl,
  ] = useState("")

  const [
    previewLoading,
    setPreviewLoading,
  ] = useState(false)

  const [
    previewError,
    setPreviewError,
  ] = useState("")

  useEffect(() => {
    loadDocuments()

    function refreshDocuments() {
      loadDocuments({
        quiet:
          true,
      })
    }

    window.addEventListener(
      "focus",
      refreshDocuments,
    )

    return () => {
      window.removeEventListener(
        "focus",
        refreshDocuments,
      )
    }
  }, [])

  useEffect(() => {
    if (
      !previewData?.base64 ||
      ![
        "pdf",
        "image",
      ].includes(
        previewData.kind,
      )
    ) {
      setPreviewUrl("")

      return undefined
    }

    const bytes =
      base64ToBytes(
        previewData.base64,
      )

    const blob =
      new Blob(
        [bytes],
        {
          type:
            previewData.mimeType ||
            "application/octet-stream",
        },
      )

    const objectUrl =
      URL.createObjectURL(
        blob,
      )

    setPreviewUrl(
      objectUrl,
    )

    return () => {
      URL.revokeObjectURL(
        objectUrl,
      )
    }
  }, [previewData])

  const filteredDocuments =
    useMemo(
      () => {
        const searchText =
          search
            .trim()
            .toLowerCase()

        return documents.filter(
          (document) => {
            const searchableText = [
              document.title,
              document.originalName,
              document.category,
              document.sourceJobRole,
              document.sourceCompany,
              document.generatedBy,
              document.generatedFormat,
              document.extension,
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase()

            const matchesSearch =
              searchableText.includes(
                searchText,
              )

            const matchesCategory =
              categoryFilter ===
                "All" ||
              document.category ===
                categoryFilter

            return (
              matchesSearch &&
              matchesCategory
            )
          },
        )
      },
      [
        documents,
        search,
        categoryFilter,
      ],
    )

  const defaults =
    useMemo(
      () => ({
        cv:
          documents.find(
            (document) =>
              document.category ===
                "CV" &&
              document.isDefault,
          ) || null,

        coverLetter:
          documents.find(
            (document) =>
              document.category ===
                "Cover Letter" &&
              document.isDefault,
          ) || null,
      }),
      [documents],
    )

  const generatedCount =
    useMemo(
      () =>
        documents.filter(
          (document) =>
            [
              "JobPilot",
              "BreakVeil",
            ].includes(
              document.generatedBy,
            ),
        ).length,
      [documents],
    )

  async function loadDocuments({
    quiet = false,
  } = {}) {
    if (!quiet) {
      setIsLoading(true)
    }

    setError("")

    if (
      !window.jobPilot
        ?.documents
        ?.list
    ) {
      setDocuments([])

      setError(
        "Document storage is unavailable. Fully restart the BreakVeil desktop app.",
      )

      setIsLoading(false)

      return
    }

    try {
      const savedDocuments =
        await window.jobPilot
          .documents
          .list()

      setDocuments(
        Array.isArray(
          savedDocuments,
        )
          ? savedDocuments
          : [],
      )
    } catch (loadError) {
      setDocuments([])

      setError(
        loadError?.message ||
          "BreakVeil could not load your documents.",
      )
    } finally {
      setIsLoading(false)
    }
  }

  function openImportWindow(
    category = "CV",
  ) {
    setImportCategory(
      category,
    )

    setError("")
    setMessage("")

    setShowImportWindow(
      true,
    )
  }

  async function importDocuments() {
    if (
      !window.jobPilot
        ?.documents
        ?.addFiles
    ) {
      setError(
        "The document importer is unavailable. Fully restart BreakVeil.",
      )

      return
    }

    setIsImporting(true)
    setError("")
    setMessage("")

    try {
      const result =
        await window.jobPilot
          .documents
          .addFiles(
            importCategory,
          )

      if (
        result?.ok ===
        false
      ) {
        throw new Error(
          result.error ||
            "The selected documents could not be imported.",
        )
      }

      const importedDocuments =
        Array.isArray(
          result,
        )
          ? result
          : Array.isArray(
                result?.documents,
              )
            ? result.documents
            : []

      if (
        importedDocuments.length >
        0
      ) {
        await loadDocuments({
          quiet:
            true,
        })

        setShowImportWindow(
          false,
        )

        setMessage(
          `${importedDocuments.length} ${importCategory.toLowerCase()} document${importedDocuments.length === 1 ? "" : "s"} imported.`,
        )

        window.dispatchEvent(
          new Event(
            "jobpilot:documents-updated",
          ),
        )
      }
    } catch (importError) {
      setError(
        importError?.message ||
          "The selected documents could not be imported.",
      )
    } finally {
      setIsImporting(false)
    }
  }

  async function previewDocument(
    document,
  ) {
    setPreviewTarget(
      document,
    )

    setPreviewData(
      null,
    )

    setPreviewError("")
    setPreviewLoading(true)
    setError("")
    setMessage("")

    if (
      !window.jobPilot
        ?.documents
        ?.preview
    ) {
      setPreviewError(
        "The in-app preview service is unavailable. Fully restart BreakVeil after installing the preview update.",
      )

      setPreviewLoading(
        false,
      )

      return
    }

    try {
      const result =
        await window.jobPilot
          .documents
          .preview(
            document.id,
          )

      if (
        !result?.ok
      ) {
        throw new Error(
          result?.error ||
            "BreakVeil could not preview this document.",
        )
      }

      setPreviewData(
        result,
      )
    } catch (previewFailure) {
      setPreviewError(
        previewFailure?.message ||
          "BreakVeil could not preview this document.",
      )
    } finally {
      setPreviewLoading(
        false,
      )
    }
  }

  function closePreview() {
    setPreviewTarget(
      null,
    )

    setPreviewData(
      null,
    )

    setPreviewError("")
    setPreviewLoading(false)
  }

  async function openDocumentExternally(
    document,
  ) {
    setError("")
    setMessage("")

    if (
      !window.jobPilot
        ?.documents
        ?.open
    ) {
      setError(
        "Document storage is unavailable. Fully restart BreakVeil.",
      )

      return
    }

    try {
      const result =
        await window.jobPilot
          .documents
          .open(
            document.id,
          )

      if (
        !result?.ok
      ) {
        throw new Error(
          result?.error ||
            "Windows could not open this document.",
        )
      }
    } catch (openError) {
      setError(
        openError?.message ||
          "Windows could not open this document.",
      )
    }
  }

  async function setDefaultDocument(
    document,
  ) {
    if (
      document.isDefault ||
      settingDefaultId
    ) {
      return
    }

    setSettingDefaultId(
      document.id,
    )

    setError("")
    setMessage("")

    try {
      const result =
        await window.jobPilot
          .documents
          .setDefault(
            document.id,
          )

      if (
        result?.ok ===
        false
      ) {
        throw new Error(
          result.error ||
            "BreakVeil could not change the default document.",
        )
      }

      await loadDocuments({
        quiet:
          true,
      })

      setMessage(
        `${document.title} is now the default ${document.category.toLowerCase()}.`,
      )

      window.dispatchEvent(
        new Event(
          "jobpilot:documents-updated",
        ),
      )
    } catch (defaultError) {
      setError(
        defaultError?.message ||
          "BreakVeil could not change the default document.",
      )
    } finally {
      setSettingDefaultId("")
    }
  }

  async function confirmDelete() {
    if (
      !deleteTarget ||
      isDeleting
    ) {
      return
    }

    setIsDeleting(true)
    setError("")
    setMessage("")

    try {
      const result =
        await window.jobPilot
          .documents
          .delete(
            deleteTarget.id,
          )

      if (
        result?.ok ===
        false
      ) {
        throw new Error(
          result.error ||
            "BreakVeil could not remove this document.",
        )
      }

      const deletedTitle =
        deleteTarget.title

      setDeleteTarget(
        null,
      )

      await loadDocuments({
        quiet:
          true,
      })

      setMessage(
        `${deletedTitle} was removed from the Resume Library.`,
      )

      window.dispatchEvent(
        new Event(
          "jobpilot:documents-updated",
        ),
      )
    } catch (deleteError) {
      setError(
        deleteError?.message ||
          "BreakVeil could not remove this document.",
      )
    } finally {
      setIsDeleting(false)
    }
  }

  function resetView() {
    setSearch("")
    setCategoryFilter(
      "All",
    )
  }

  const filtersActive =
    Boolean(
      search.trim(),
    ) ||
    categoryFilter !==
      "All"

  return (
    <div className="min-w-0 pb-8">
      <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
        <div>
          <p className="text-sm font-medium text-zinc-500">
            Application documents
          </p>

          <h1 className="mt-1 text-3xl font-bold tracking-tight">
            Resume Library
          </h1>

          <p className="mt-2 max-w-2xl text-zinc-400">
            Manage the CVs, cover letters and supporting documents available inside each Job Workspace.
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            openImportWindow(
              "CV",
            )
          }
          className="inline-flex w-fit shrink-0 items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-zinc-200"
        >
          <Upload
            size={17}
          />
          Import documents
        </button>
      </header>

      <section
        aria-label="Default application documents"
        className="mt-8 grid gap-4 lg:grid-cols-2"
      >
        <DefaultDocumentCard
          title="Default CV"
          description="Selected automatically when you prepare a new application."
          document={
            defaults.cv
          }
          emptyLabel="No default CV"
          onPreview={
            previewDocument
          }
          onOpenExternally={
            openDocumentExternally
          }
          onImport={() =>
            openImportWindow(
              "CV",
            )
          }
        />

        <DefaultDocumentCard
          title="Default cover letter"
          description="Used as the starting attachment when a cover letter is available."
          document={
            defaults.coverLetter
          }
          emptyLabel="No default cover letter"
          onPreview={
            previewDocument
          }
          onOpenExternally={
            openDocumentExternally
          }
          onImport={() =>
            openImportWindow(
              "Cover Letter",
            )
          }
        />
      </section>

      <section className="jp-grid-compact mt-6 gap-3">
        <button
          type="button"
          onClick={() =>
            setCategoryFilter(
              "All",
            )
          }
          className={[
            "rounded-xl border p-4 text-left transition",

            categoryFilter ===
              "All"
              ? "border-zinc-500 bg-zinc-800"
              : "border-zinc-800 bg-[#151515] hover:border-zinc-700",
          ].join(" ")}
        >
          <p className="text-sm text-zinc-400">
            All documents
          </p>

          <p className="mt-1 text-2xl font-bold">
            {
              documents.length
            }
          </p>

          <p className="mt-2 text-xs text-zinc-600">
            {generatedCount} generated by BreakVeil
          </p>
        </button>

        {categories.map(
          (category) => {
            const total =
              documents.filter(
                (document) =>
                  document.category ===
                  category,
              ).length

            return (
              <button
                key={
                  category
                }
                type="button"
                onClick={() =>
                  setCategoryFilter(
                    categoryFilter ===
                      category
                      ? "All"
                      : category,
                  )
                }
                className={[
                  "rounded-xl border p-4 text-left transition",

                  categoryFilter ===
                    category
                    ? "border-zinc-500 bg-zinc-800"
                    : "border-zinc-800 bg-[#151515] hover:border-zinc-700",
                ].join(
                  " ",
                )}
              >
                <p className="text-sm text-zinc-400">
                  {
                    category
                  }
                </p>

                <p className="mt-1 text-2xl font-bold">
                  {
                    total
                  }
                </p>

                <p className="mt-2 line-clamp-2 text-xs leading-5 text-zinc-600">
                  {
                    categoryDescriptions[
                      category
                    ]
                  }
                </p>
              </button>
            )
          },
        )}
      </section>

      <section className="mt-6">
        <div className="flex flex-col gap-3 md:flex-row">
          <div className="flex h-11 flex-1 items-center gap-3 rounded-lg border border-zinc-800 bg-[#151515] px-3 transition focus-within:border-zinc-600">
            <Search
              size={17}
              className="shrink-0 text-zinc-500"
            />

            <input
              value={
                search
              }
              onChange={(event) =>
                setSearch(
                  event.target.value,
                )
              }
              aria-label="Search Resume Library"
              placeholder="Search names, companies, jobs or file types..."
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-zinc-600"
            />

            {search && (
              <button
                type="button"
                onClick={() =>
                  setSearch("")
                }
                aria-label="Clear document search"
                title="Clear search"
                className="rounded-md p-1.5 text-zinc-600 transition hover:bg-zinc-800 hover:text-zinc-300"
              >
                <X
                  size={15}
                />
              </button>
            )}
          </div>

          {filtersActive && (
            <button
              type="button"
              onClick={
                resetView
              }
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-zinc-800 px-4 text-sm text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
            >
              <RefreshCw
                size={15}
              />
              Reset view
            </button>
          )}
        </div>

        {!isLoading &&
          documents.length >
            0 && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-600">
              <span>
                Showing {filteredDocuments.length} of {documents.length} document{documents.length === 1 ? "" : "s"}
              </span>

              {categoryFilter !==
                "All" && (
                <span>
                  Category: {categoryFilter}
                </span>
              )}
            </div>
          )}
      </section>

      {message && (
        <div className="mt-5 flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-200">
          <CheckCircle2
            size={17}
            className="mt-0.5 shrink-0"
          />

          <span>
            {message}
          </span>
        </div>
      )}

      {error && (
        <div className="mt-5 flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
          <AlertTriangle
            size={17}
            className="mt-0.5 shrink-0"
          />

          <span>
            {error}
          </span>
        </div>
      )}

      {isLoading ? (
        <LoadingDocuments />
      ) : filteredDocuments.length ===
        0 ? (
        <EmptyLibrary
          hasDocuments={
            documents.length >
            0
          }
          onImport={() =>
            openImportWindow(
              categoryFilter ===
                "All"
                ? "CV"
                : categoryFilter,
            )
          }
          onReset={
            resetView
          }
        />
      ) : (
        <div className="jp-grid-cards mt-6 gap-4">
          {filteredDocuments.map(
            (document) => (
              <DocumentCard
                key={
                  document.id
                }
                document={
                  document
                }
                settingDefault={
                  settingDefaultId ===
                  document.id
                }
                onSetDefault={
                  setDefaultDocument
                }
                onPreview={
                  previewDocument
                }
                onOpenExternally={
                  openDocumentExternally
                }
                onDelete={
                  setDeleteTarget
                }
              />
            ),
          )}
        </div>
      )}

      {previewTarget && (
        <DocumentPreviewModal
          document={
            previewTarget
          }
          preview={
            previewData
          }
          previewUrl={
            previewUrl
          }
          loading={
            previewLoading
          }
          error={
            previewError
          }
          onOpenExternally={() =>
            openDocumentExternally(
              previewTarget,
            )
          }
          onClose={
            closePreview
          }
        />
      )}

      {showImportWindow && (
        <ImportDocumentsModal
          category={
            importCategory
          }
          isImporting={
            isImporting
          }
          onCategoryChange={
            setImportCategory
          }
          onImport={
            importDocuments
          }
          onClose={() =>
            !isImporting &&
            setShowImportWindow(
              false,
            )
          }
        />
      )}

      {deleteTarget && (
        <DeleteDocumentModal
          document={
            deleteTarget
          }
          documents={
            documents
          }
          isDeleting={
            isDeleting
          }
          onConfirm={
            confirmDelete
          }
          onClose={() =>
            !isDeleting &&
            setDeleteTarget(
              null,
            )
          }
        />
      )}
    </div>
  )
}

function DefaultDocumentCard({
  title,
  description,
  document,
  emptyLabel,
  onPreview,
  onOpenExternally,
  onImport,
}) {
  return (
    <article className="rounded-xl border border-zinc-800 bg-[#151515] p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-300">
            <Star
              size={17}
            />
          </div>

          <div className="min-w-0">
            <h2 className="font-semibold text-zinc-100">
              {title}
            </h2>

            <p className="mt-1 text-xs leading-5 text-zinc-600">
              {
                description
              }
            </p>
          </div>
        </div>

        {document && (
          <span className="shrink-0 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-300">
            Default
          </span>
        )}
      </div>

      {document ? (
        <div className="mt-5 flex flex-col justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-950/35 p-4 sm:flex-row sm:items-center">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-zinc-200">
              {
                document.title
              }
            </p>

            <p className="mt-1 truncate text-xs text-zinc-600">
              {
                document.originalName ||
                formatDocumentType(
                  document,
                )
              }
            </p>
          </div>

          <div className="flex w-fit shrink-0 flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                onPreview(
                  document,
                )
              }
              className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-black transition hover:bg-zinc-200"
            >
              <Eye
                size={14}
              />
              Preview
            </button>

            <button
              type="button"
              onClick={() =>
                onOpenExternally(
                  document,
                )
              }
              aria-label={`Open ${document.title} externally`}
              title="Open externally"
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 transition hover:bg-zinc-800"
            >
              <ExternalLink
                size={14}
              />
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-5 flex flex-col justify-between gap-3 rounded-xl border border-dashed border-zinc-800 bg-zinc-950/25 p-4 sm:flex-row sm:items-center">
          <p className="text-sm text-zinc-600">
            {
              emptyLabel
            }
          </p>

          <button
            type="button"
            onClick={
              onImport
            }
            className="inline-flex w-fit items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 transition hover:bg-zinc-800"
          >
            <Upload
              size={14}
            />
            Import
          </button>
        </div>
      )}
    </article>
  )
}

function DocumentCard({
  document,
  settingDefault,
  onSetDefault,
  onPreview,
  onOpenExternally,
  onDelete,
}) {
  const generated =
    [
      "JobPilot",
      "BreakVeil",
    ].includes(
      document.generatedBy,
    )

  const sourceLabel =
    [
      document.sourceJobRole,
      document.sourceCompany,
    ]
      .filter(Boolean)
      .join(" at ")

  return (
    <article
      className={[
        "flex min-h-64 flex-col rounded-xl border bg-[#151515] p-5 transition",

        generated
          ? "jp-document-card"
          : "border-zinc-800 hover:border-zinc-700",
      ].join(
        " ",
      )}
    >
      <div className="flex items-start gap-4">
        <div
          className={[
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border",

            generated
              ? "jp-tone-document"
              : "jp-tone-neutral",
          ].join(
            " ",
          )}
        >
          {generated ? (
            <Sparkles
              size={20}
            />
          ) : (
            <FileCheck2
              size={20}
            />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
            <div className="min-w-0">
              <h2
                className="truncate font-semibold text-zinc-100"
                title={
                  document.title
                }
              >
                {
                  document.title ||
                  "Untitled document"
                }
              </h2>

              <p
                className="mt-1 truncate text-xs text-zinc-600"
                title={
                  document.originalName
                }
              >
                {
                  document.originalName ||
                  "Original filename unavailable"
                }
              </p>
            </div>

            <span className="w-fit shrink-0 rounded-full border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-xs text-zinc-300">
              {
                document.category ||
                "Other"
              }
            </span>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {document.isDefault && (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-[11px] font-medium text-amber-300">
                <Star
                  size={11}
                />
                Default
              </span>
            )}

            {generated && (
              <span className="jp-tone-document inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-medium">
                <Sparkles
                  size={11}
                />
                Generated by BreakVeil
              </span>
            )}
          </div>

          {sourceLabel && (
            <p className="mt-3 line-clamp-2 text-xs leading-5 text-indigo-300/80">
              Created for {
                sourceLabel
              }
            </p>
          )}
        </div>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-3 rounded-xl border border-zinc-800 bg-zinc-950/30 p-4 text-xs">
        <DocumentDetail
          label="File type"
          value={
            formatDocumentType(
              document,
            )
          }
        />

        <DocumentDetail
          label="File size"
          value={
            formatFileSize(
              document.sizeBytes,
            )
          }
        />

        <DocumentDetail
          label={
            generated
              ? "Last updated"
              : "Added"
          }
          value={
            formatDocumentDate(
              document,
            )
          }
        />

        <DocumentDetail
          label="Stored as"
          value={
            document.generatedFormat
              ? document.generatedFormat.toUpperCase()
              : "Local document"
          }
        />
      </dl>

      <div className="mt-auto flex flex-wrap items-center justify-end gap-2 border-t border-zinc-800 pt-4">
        {!document.isDefault && (
          <button
            type="button"
            disabled={
              settingDefault
            }
            onClick={() =>
              onSetDefault(
                document,
              )
            }
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {settingDefault ? (
              <RefreshCw
                size={14}
                className="animate-spin"
              />
            ) : (
              <Star
                size={14}
              />
            )}

            {settingDefault
              ? "Updating"
              : `Make default ${document.category?.toLowerCase() || "document"}`}
          </button>
        )}

        <button
          type="button"
          onClick={() =>
            onPreview(
              document,
            )
          }
          className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-black transition hover:bg-zinc-200"
        >
          <Eye
            size={14}
          />
          Preview
        </button>

        <button
          type="button"
          onClick={() =>
            onOpenExternally(
              document,
            )
          }
          className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 transition hover:bg-zinc-800"
        >
          <ExternalLink
            size={14}
          />
          Open externally
        </button>

        <button
          type="button"
          onClick={() =>
            onDelete(
              document,
            )
          }
          className="inline-flex items-center gap-2 rounded-lg border border-red-500/20 px-3 py-2 text-xs text-red-300 transition hover:bg-red-500/10"
        >
          <Trash2
            size={14}
          />
          Remove
        </button>
      </div>
    </article>
  )
}

function DocumentDetail({
  label,
  value,
}) {
  return (
    <div className="min-w-0">
      <dt className="text-zinc-600">
        {label}
      </dt>

      <dd
        className="mt-1 truncate font-medium text-zinc-400"
        title={
          value
        }
      >
        {value}
      </dd>
    </div>
  )
}

function LoadingDocuments() {
  return (
    <div className="jp-grid-cards mt-6 gap-4">
      {[0, 1, 2, 3].map(
        (item) => (
          <div
            key={
              item
            }
            className="h-64 animate-pulse rounded-xl border border-zinc-800 bg-[#151515]"
          />
        ),
      )}
    </div>
  )
}

function EmptyLibrary({
  hasDocuments,
  onImport,
  onReset,
}) {
  return (
    <div className="mt-6 flex min-h-80 flex-col items-center justify-center rounded-xl border border-dashed border-zinc-800 bg-[#111111] px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-800">
        <FileText
          size={24}
          className="text-zinc-400"
        />
      </div>

      <h2 className="mt-5 text-lg font-semibold">
        {hasDocuments
          ? "No documents match this view"
          : "Your Resume Library is empty"}
      </h2>

      <p className="mt-2 max-w-md text-sm leading-6 text-zinc-500">
        {hasDocuments
          ? "Reset the search and category filter to return to your complete document library."
          : "Import a CV first, then add reusable cover letters, certificates or other supporting documents."}
      </p>

      <button
        type="button"
        onClick={
          hasDocuments
            ? onReset
            : onImport
        }
        className="mt-5 inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-zinc-200"
      >
        {hasDocuments ? (
          <RefreshCw
            size={16}
          />
        ) : (
          <Upload
            size={16}
          />
        )}

        {hasDocuments
          ? "Reset view"
          : "Import your first document"}
      </button>
    </div>
  )
}

function DocumentPreviewModal({
  document,
  preview,
  previewUrl,
  loading,
  error,
  onOpenExternally,
  onClose,
}) {
  const title =
    preview?.document
      ?.title ||
    document.title ||
    "Document preview"

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-3 backdrop-blur-sm sm:p-5"
      onClick={
        onClose
      }
    >
      <div
        className="flex h-[min(94vh,980px)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-zinc-700 bg-[#111111] shadow-2xl"
        onClick={(event) =>
          event.stopPropagation()
        }
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-zinc-800 bg-[#151515] px-4 py-4 sm:px-6">
          <div className="flex min-w-0 items-start gap-3">
            <div className="jp-tone-document flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border">
              <Eye
                size={18}
              />
            </div>

            <div className="min-w-0">
              <h2 className="truncate text-lg font-semibold sm:text-xl">
                {title}
              </h2>

              <p className="mt-1 truncate text-xs text-zinc-600">
                {
                  document.originalName ||
                  formatDocumentType(
                    document,
                  )
                }
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={
                onOpenExternally
              }
              className="hidden items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 transition hover:bg-zinc-800 sm:inline-flex"
            >
              <ExternalLink
                size={15}
              />
              Open externally
            </button>

            <button
              type="button"
              onClick={
                onClose
              }
              aria-label="Close document preview"
              title="Close preview"
              className="rounded-lg p-2 text-zinc-500 transition hover:bg-zinc-800 hover:text-white"
            >
              <X
                size={19}
              />
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-hidden bg-zinc-950">
          {loading ? (
            <div className="flex h-full flex-col items-center justify-center px-6 text-center">
              <RefreshCw
                size={24}
                className="animate-spin text-zinc-500"
              />

              <p className="mt-4 text-sm text-zinc-400">
                Preparing preview
              </p>
            </div>
          ) : error ? (
            <PreviewMessage
              title="Preview unavailable"
              description={
                error
              }
              onOpenExternally={
                onOpenExternally
              }
            />
          ) : preview?.kind ===
              "pdf" &&
            previewUrl ? (
            <iframe
              src={
                previewUrl
              }
              title={`${title} PDF preview`}
              className="h-full w-full border-0 bg-white"
            />
          ) : preview?.kind ===
              "image" &&
            previewUrl ? (
            <div className="flex h-full overflow-auto p-6">
              <img
                src={
                  previewUrl
                }
                alt={
                  title
                }
                className="m-auto max-h-full max-w-full rounded-lg object-contain shadow-2xl"
              />
            </div>
          ) : preview?.kind ===
            "text" ? (
            <div className="h-full overflow-y-auto p-4 sm:p-8">
              {preview.notice && (
                <div className="mx-auto mb-5 max-w-4xl rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm leading-6 text-amber-200">
                  {
                    preview.notice
                  }
                </div>
              )}

              <article className="mx-auto min-h-full max-w-4xl rounded-lg bg-white px-6 py-8 text-zinc-900 shadow-2xl sm:px-12 sm:py-12">
                <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-7">
                  {
                    preview.text ||
                    "This document does not contain readable text."
                  }
                </pre>
              </article>
            </div>
          ) : (
            <PreviewMessage
              title="External viewing required"
              description={
                preview?.message ||
                "This document does not have an in-app preview."
              }
              onOpenExternally={
                onOpenExternally
              }
            />
          )}
        </div>

        <footer className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-zinc-800 bg-[#151515] px-4 py-3 sm:px-6">
          <button
            type="button"
            onClick={
              onClose
            }
            className="rounded-lg border border-zinc-700 px-4 py-2.5 text-sm text-zinc-300 transition hover:bg-zinc-800"
          >
            Close
          </button>

          <button
            type="button"
            onClick={
              onOpenExternally
            }
            className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-zinc-200 sm:hidden"
          >
            <ExternalLink
              size={15}
            />
            Open externally
          </button>
        </footer>
      </div>
    </div>
  )
}

function PreviewMessage({
  title,
  description,
  onOpenExternally,
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-zinc-700 bg-zinc-800 text-zinc-300">
        <FileText
          size={24}
        />
      </div>

      <h3 className="mt-5 text-lg font-semibold">
        {title}
      </h3>

      <p className="mt-2 max-w-lg text-sm leading-6 text-zinc-500">
        {
          description
        }
      </p>

      <button
        type="button"
        onClick={
          onOpenExternally
        }
        className="mt-5 inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-zinc-200"
      >
        <ExternalLink
          size={16}
        />
        Open externally
      </button>
    </div>
  )
}

function ImportDocumentsModal({
  category,
  isImporting,
  onCategoryChange,
  onImport,
  onClose,
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      onClick={
        onClose
      }
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-zinc-700 bg-[#151515] shadow-2xl"
        onClick={(event) =>
          event.stopPropagation()
        }
      >
        <header className="flex items-start justify-between gap-4 border-b border-zinc-800 px-5 py-5 sm:px-6">
          <div>
            <h2 className="text-xl font-semibold">
              Import documents
            </h2>

            <p className="mt-1 text-sm text-zinc-500">
              Choose how BreakVeil should organise the selected files.
            </p>
          </div>

          <button
            type="button"
            disabled={
              isImporting
            }
            onClick={
              onClose
            }
            aria-label="Close document importer"
            className="rounded-lg p-2 text-zinc-500 transition hover:bg-zinc-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X
              size={19}
            />
          </button>
        </header>

        <div className="p-5 sm:p-6">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-zinc-300">
              Document category
            </span>

            <select
              value={
                category
              }
              onChange={(event) =>
                onCategoryChange(
                  event.target.value,
                )
              }
              disabled={
                isImporting
              }
              className="h-11 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm text-white outline-none transition focus:border-zinc-500 disabled:opacity-50"
            >
              {categories.map(
                (
                  categoryOption,
                ) => (
                  <option
                    key={
                      categoryOption
                    }
                    value={
                      categoryOption
                    }
                  >
                    {
                      categoryOption
                    }
                  </option>
                ),
              )}
            </select>
          </label>

          <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
            <p className="text-sm font-medium text-zinc-300">
              {
                category
              }
            </p>

            <p className="mt-1 text-xs leading-5 text-zinc-600">
              {
                categoryDescriptions[
                  category
                ]
              }
            </p>
          </div>

          <div className="mt-5 rounded-xl border border-dashed border-zinc-700 bg-zinc-900/40 p-5 text-center">
            <Upload
              size={24}
              className="mx-auto text-zinc-500"
            />

            <p className="mt-3 text-sm text-zinc-300">
              Select one or several files
            </p>

            <p className="mt-1 text-xs text-zinc-600">
              PDF, DOC, DOCX, TXT, RTF and ODT
            </p>
          </div>
        </div>

        <footer className="flex flex-wrap justify-end gap-2 border-t border-zinc-800 bg-zinc-950/30 px-5 py-4 sm:px-6">
          <button
            type="button"
            disabled={
              isImporting
            }
            onClick={
              onClose
            }
            className="rounded-lg border border-zinc-700 px-4 py-2.5 text-sm text-zinc-300 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={
              isImporting
            }
            onClick={
              onImport
            }
            className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
          >
            {isImporting ? (
              <RefreshCw
                size={16}
                className="animate-spin"
              />
            ) : (
              <Upload
                size={16}
              />
            )}

            {isImporting
              ? "Importing"
              : "Choose files"}
          </button>
        </footer>
      </div>
    </div>
  )
}

function DeleteDocumentModal({
  document,
  documents,
  isDeleting,
  onConfirm,
  onClose,
}) {
  const sameCategoryDocuments =
    documents.filter(
      (item) =>
        item.id !==
          document.id &&
        item.category ===
          document.category,
    )

  const replacement =
    sameCategoryDocuments[0] ||
    null

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onClick={
        onClose
      }
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl border border-red-500/20 bg-[#151515] shadow-2xl"
        onClick={(event) =>
          event.stopPropagation()
        }
      >
        <div className="p-5 sm:p-6">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-red-500/20 bg-red-500/10 text-red-300">
            <AlertTriangle
              size={20}
            />
          </div>

          <h2 className="mt-5 text-xl font-semibold">
            Remove document?
          </h2>

          <p className="mt-2 break-words text-sm leading-6 text-zinc-400">
            <span className="font-medium text-zinc-200">
              {
                document.title
              }
            </span>{" "}
            will be removed from BreakVeil’s local document storage.
          </p>

          <div className="mt-5 rounded-xl border border-zinc-800 bg-zinc-900/45 p-4 text-xs leading-5 text-zinc-500">
            {document.isDefault ? (
              replacement ? (
                <>
                  This is currently the default {document.category.toLowerCase()}.{" "}
                  <span className="text-zinc-300">
                    {
                      replacement.title
                    }
                  </span>{" "}
                  will become the new default automatically.
                </>
              ) : (
                <>
                  This is currently the default {document.category.toLowerCase()}. There will be no default in this category after removal.
                </>
              )
            ) : (
              <>
                Existing application records may still mention this document, but it will no longer be available to open or select.
              </>
            )}
          </div>
        </div>

        <footer className="flex flex-wrap justify-end gap-2 border-t border-zinc-800 bg-zinc-950/30 px-5 py-4 sm:px-6">
          <button
            type="button"
            disabled={
              isDeleting
            }
            onClick={
              onClose
            }
            className="rounded-lg border border-zinc-700 px-4 py-2.5 text-sm text-zinc-300 transition hover:bg-zinc-800 disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={
              isDeleting
            }
            onClick={
              onConfirm
            }
            className="inline-flex items-center gap-2 rounded-lg border border-red-500/25 bg-red-500/10 px-4 py-2.5 text-sm font-medium text-red-200 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isDeleting ? (
              <RefreshCw
                size={16}
                className="animate-spin"
              />
            ) : (
              <Trash2
                size={16}
              />
            )}

            {isDeleting
              ? "Removing"
              : "Remove document"}
          </button>
        </footer>
      </div>
    </div>
  )
}

function base64ToBytes(
  base64,
) {
  const binary =
    window.atob(
      base64,
    )

  const bytes =
    new Uint8Array(
      binary.length,
    )

  for (
    let index = 0;
    index <
      binary.length;
    index += 1
  ) {
    bytes[index] =
      binary.charCodeAt(
        index,
      )
  }

  return bytes
}

function formatDocumentDate(
  document,
) {
  const value =
    document.updatedAt ||
    document.addedAt ||
    document.importedAt ||
    document.createdAt

  const date =
    new Date(
      value,
    )

  return Number.isNaN(
    date.getTime(),
  )
    ? "Unknown date"
    : date.toLocaleDateString(
        "en-GB",
        {
          day:
            "numeric",

          month:
            "short",

          year:
            "numeric",
        },
      )
}

function formatDocumentType(
  document,
) {
  const rawExtension =
    String(
      document.generatedFormat ||
        document.extension ||
        document.originalName
          ?.split(".")
          .pop() ||
        "",
    )
      .replace(
        /^\./,
        "",
      )
      .trim()
      .toUpperCase()

  return (
    rawExtension ||
    "Document"
  )
}

function formatFileSize(
  sizeInBytes,
) {
  const safeSize =
    Number(
      sizeInBytes,
    )

  if (
    !Number.isFinite(
      safeSize,
    ) ||
    safeSize <= 0
  ) {
    return "Unknown size"
  }

  if (
    safeSize <
    1024
  ) {
    return `${safeSize} B`
  }

  if (
    safeSize <
    1024 * 1024
  ) {
    return `${(
      safeSize /
      1024
    ).toFixed(1)} KB`
  }

  return `${(
    safeSize /
    (1024 * 1024)
  ).toFixed(1)} MB`
}
