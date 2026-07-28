const {
  contextBridge,
  ipcRenderer,
} = require("electron")

contextBridge.exposeInMainWorld(
  "jobPilot",
  {
    platform: process.platform,

    appSettings: {
      get: () =>
        ipcRenderer.invoke(
          "app-settings:get",
        ),

      update: (changes) =>
        ipcRenderer.invoke(
          "app-settings:update",
          changes,
        ),
    },

    dataRecovery: {
      getStatus: () =>
        ipcRenderer.invoke(
          "data-recovery:get-status",
        ),

      createQuarantine: (payload) =>
        ipcRenderer.invoke(
          "data-recovery:create-quarantine",
          payload,
        ),

      getLatestSnapshot: () =>
        ipcRenderer.invoke(
          "data-recovery:get-latest-snapshot",
        ),

      repairDocumentIndex: () =>
        ipcRenderer.invoke(
          "data-recovery:repair-document-index",
        ),

      openFolder: () =>
        ipcRenderer.invoke(
          "data-recovery:open-folder",
        ),
    },

    dataMigrations: {
      getStatus: () =>
        ipcRenderer.invoke(
          "data-migrations:get-status",
        ),

      prepare: (payload) =>
        ipcRenderer.invoke(
          "data-migrations:prepare",
          payload,
        ),

      complete: (payload) =>
        ipcRenderer.invoke(
          "data-migrations:complete",
          payload,
        ),

      openFolder: () =>
        ipcRenderer.invoke(
          "data-migrations:open-folder",
        ),
    },

    dataManagement: {
      getStatus: () =>
        ipcRenderer.invoke(
          "data-management:get-status",
        ),

      updateSettings: (changes) =>
        ipcRenderer.invoke(
          "data-management:update-settings",
          changes,
        ),

      createBackup: (rendererStorage) =>
        ipcRenderer.invoke(
          "data-management:create-backup",
          rendererStorage,
        ),

      runAutomaticBackup: (rendererStorage) =>
        ipcRenderer.invoke(
          "data-management:run-automatic-backup",
          rendererStorage,
        ),

      restoreBackup: (rendererStorage) =>
        ipcRenderer.invoke(
          "data-management:restore-backup",
          rendererStorage,
        ),

      exportAll: (payload) =>
        ipcRenderer.invoke(
          "data-management:export-all",
          payload,
        ),

      openStorage: () =>
        ipcRenderer.invoke(
          "data-management:open-storage",
        ),

      clearGmailLogs: () =>
        ipcRenderer.invoke(
          "data-management:clear-gmail-logs",
        ),

      resetApplicationData: () =>
        ipcRenderer.invoke(
          "data-management:reset-application-data",
        ),
    },

    documents: {
      list: () =>
        ipcRenderer.invoke(
          "documents:list",
        ),

      addFiles: (category) =>
        ipcRenderer.invoke(
          "documents:add-files",
          category,
        ),

      saveGenerated: (generatedDetails) =>
        ipcRenderer.invoke(
          "documents:save-generated",
          generatedDetails,
        ),

      preview: (documentId) =>
        ipcRenderer.invoke(
          "documents:preview",
          documentId,
        ),

      open: (documentId) =>
        ipcRenderer.invoke(
          "documents:open",
          documentId,
        ),

      setDefault: (documentId) =>
        ipcRenderer.invoke(
          "documents:set-default",
          documentId,
        ),

      delete: (documentId) =>
        ipcRenderer.invoke(
          "documents:delete",
          documentId,
        ),
    },

    gmail: {
      getStatus: () =>
        ipcRenderer.invoke(
          "gmail:get-status",
        ),

      importCredentials: () =>
        ipcRenderer.invoke(
          "gmail:import-credentials",
        ),

      connect: () =>
        ipcRenderer.invoke(
          "gmail:connect",
        ),

      disconnect: () =>
        ipcRenderer.invoke(
          "gmail:disconnect",
        ),

      createDraft: (draftDetails) =>
        ipcRenderer.invoke(
          "gmail:create-draft",
          draftDetails,
        ),

      openDrafts: () =>
        ipcRenderer.invoke(
          "gmail:open-drafts",
        ),

      getSendControl: () =>
        ipcRenderer.invoke(
          "gmail:get-send-control",
        ),

      updateSendControl: (changes) =>
        ipcRenderer.invoke(
          "gmail:update-send-control",
          changes,
        ),

      resetAutoSession: () =>
        ipcRenderer.invoke(
          "gmail:reset-auto-session",
        ),

      sendDraft: (sendDetails) =>
        ipcRenderer.invoke(
          "gmail:send-draft",
          sendDetails,
        ),

      autoSendDraft: (sendDetails) =>
        ipcRenderer.invoke(
          "gmail:auto-send-draft",
          sendDetails,
        ),
    },

    companyResearch: {
      getStatus: () =>
        ipcRenderer.invoke(
          "company-research:get-status",
        ),

      saveCompaniesHouse: (payload) =>
        ipcRenderer.invoke(
          "company-research:save-companies-house",
          payload,
        ),

      testCompaniesHouse: () =>
        ipcRenderer.invoke(
          "company-research:test-companies-house",
        ),

      removeCompaniesHouse: () =>
        ipcRenderer.invoke(
          "company-research:remove-companies-house",
        ),

      searchCompaniesHouse: (companyName) =>
        ipcRenderer.invoke(
          "company-research:search-companies-house",
          companyName,
        ),

      searchWikipedia: (companyName) =>
        ipcRenderer.invoke(
          "company-research:search-wikipedia",
          companyName,
        ),

      searchNews: (companyName) =>
        ipcRenderer.invoke(
          "company-research:search-news",
          companyName,
        ),

      buildReport: (payload) =>
        ipcRenderer.invoke(
          "company-research:build-report",
          payload,
        ),
    },

    jobSources: {
      getStatus: () =>
        ipcRenderer.invoke(
          "job-sources:get-status",
        ),

      saveSource: (sourceDetails) =>
        ipcRenderer.invoke(
          "job-sources:save",
          sourceDetails,
        ),

      testSource: (source) =>
        ipcRenderer.invoke(
          "job-sources:test",
          source,
        ),

      removeSource: (source) =>
        ipcRenderer.invoke(
          "job-sources:remove",
          source,
        ),

      clearCache: () =>
        ipcRenderer.invoke(
          "job-sources:clear-cache",
        ),

      searchJobs: (searchDetails) =>
        ipcRenderer.invoke(
          "job-sources:search",
          searchDetails,
        ),
    },

    directEmployerSources: {
      list: () =>
        ipcRenderer.invoke(
          "direct-employer-sources:list",
        ),

      addAndTest: (payload) =>
        ipcRenderer.invoke(
          "direct-employer-sources:add-and-test",
          payload,
        ),

      retest: (sourceId) =>
        ipcRenderer.invoke(
          "direct-employer-sources:retest",
          sourceId,
        ),

      setPermissions: (sourceId, changes) =>
        ipcRenderer.invoke(
          "direct-employer-sources:set-permissions",
          sourceId,
          changes,
        ),

      remove: (sourceId) =>
        ipcRenderer.invoke(
          "direct-employer-sources:remove",
          sourceId,
        ),
    },

    customJobSources: {
      list: () =>
        ipcRenderer.invoke(
          "custom-job-sources:list",
        ),

      saveAndTest: (connectorDetails) =>
        ipcRenderer.invoke(
          "custom-job-sources:save-and-test",
          connectorDetails,
        ),

      retest: (sourceId) =>
        ipcRenderer.invoke(
          "custom-job-sources:retest",
          sourceId,
        ),

      activate: (sourceId) =>
        ipcRenderer.invoke(
          "custom-job-sources:activate",
          sourceId,
        ),

      setPermissions: (sourceId, changes) =>
        ipcRenderer.invoke(
          "custom-job-sources:set-permissions",
          sourceId,
          changes,
        ),

      remove: (sourceId) =>
        ipcRenderer.invoke(
          "custom-job-sources:remove",
          sourceId,
        ),
    },
  },
)
