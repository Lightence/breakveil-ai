const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")

const {
  createDirectEmployerSourceService,
  isDirectEmployerSourceId,
  __testing,
} = require("../electron/direct-employer-sources.cjs")

const {
  cleanText,
  normaliseCareersBoardUrl,
} = __testing


test("decodes and removes escaped ATS markup before displaying descriptions", () => {
  const cleaned = cleanText(
    "&amp;lt;div class=&amp;quot;content-intro&amp;quot;&amp;gt;" +
      "&amp;lt;h2&amp;gt;&amp;lt;strong&amp;gt;About the London office&amp;lt;/strong&amp;gt;&amp;lt;/h2&amp;gt;" +
      "&amp;lt;p&amp;gt;Support operations &amp;amp;amp; maintain accurate records.&amp;lt;/p&amp;gt;" +
      "&amp;lt;ul&amp;gt;&amp;lt;li&amp;gt;Prepare reports&amp;lt;/li&amp;gt;&amp;lt;/ul&amp;gt;" +
      "&amp;lt;script&amp;gt;window.bad = true&amp;lt;/script&amp;gt;" +
      "&amp;lt;/div&amp;gt;",
  )

  assert.match(cleaned, /About the London office/)
  assert.match(cleaned, /Support operations & maintain accurate records/)
  assert.match(cleaned, /• Prepare reports/)
  assert.doesNotMatch(cleaned, /<[^>]+>/)
  assert.doesNotMatch(cleaned, /&(?:amp|lt|gt|quot);/)
  assert.doesNotMatch(cleaned, /window\.bad/)
})

test("recognises supported public careers-board links", () => {
  assert.deepEqual(
    normaliseCareersBoardUrl(
      "https://boards.greenhouse.io/examplecompany/jobs/123",
    ),
    {
      platform: "greenhouse",
      identifier: "examplecompany",
      region: "global",
      careersUrl:
        "https://boards.greenhouse.io/examplecompany/jobs/123",
    },
  )

  assert.equal(
    normaliseCareersBoardUrl(
      "https://jobs.eu.lever.co/example-company",
    ).region,
    "eu",
  )

  assert.equal(
    normaliseCareersBoardUrl(
      "https://careers.smartrecruiters.com/ExampleCompany",
    ).identifier,
    "ExampleCompany",
  )
})

test("rejects unsupported or insecure careers-board links", () => {
  assert.throws(
    () =>
      normaliseCareersBoardUrl(
        "http://boards.greenhouse.io/example",
      ),
    /HTTPS/,
  )

  assert.throws(
    () =>
      normaliseCareersBoardUrl(
        "https://example.com/jobs",
      ),
    /not a supported/,
  )
})

test("direct employer source IDs remain narrowly scoped", () => {
  assert.equal(
    isDirectEmployerSourceId(
      "employer:123e4567-e89b-12d3-a456-426614174000",
    ),
    true,
  )
  assert.equal(isDirectEmployerSourceId("employer:../../bad"), false)
  assert.equal(isDirectEmployerSourceId("custom:123"), false)
})

test("adds, searches and permission-gates a Greenhouse employer", async () => {
  const storageRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "jobpilot-phase-9.4-"),
  )
  const originalFetch = global.fetch

  const requestedUrls = []

  global.fetch = async (url) => {
    const safeUrl = String(url)
    requestedUrls.push(safeUrl)

    if (
      safeUrl ===
      "https://boards-api.greenhouse.io/v1/boards/examplecompany/jobs"
    ) {
      return new Response(
        JSON.stringify({
          jobs: [
            {
              id: 42,
              title: "Office Administrator",
              updated_at: "2026-07-20T10:00:00Z",
              location: {
                name: "London, United Kingdom",
              },
              absolute_url:
                "https://boards.greenhouse.io/examplecompany/jobs/42",
            },
          ],
          meta: {
            total: 1,
          },
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        },
      )
    }

    assert.equal(
      safeUrl,
      "https://boards-api.greenhouse.io/v1/boards/examplecompany/jobs/42",
    )

    return new Response(
      JSON.stringify({
        id: 42,
        title: "Office Administrator",
        updated_at: "2026-07-20T10:00:00Z",
        location: {
          name: "London, United Kingdom",
        },
        absolute_url:
          "https://boards.greenhouse.io/examplecompany/jobs/42",
        content:
          "<p>Support the office team and maintain accurate records.</p>",
        departments: [
          {
            name: "Operations",
          },
        ],
      }),
      {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      },
    )
  }

  try {
    const service = createDirectEmployerSourceService({
      app: {
        getPath(name) {
          assert.equal(name, "userData")
          return storageRoot
        },
      },
      getErrorMessage(error) {
        return error?.message || String(error)
      },
    })

    const added = await (async () => {
      // Exercise the same IPC-free service through a tiny fake handler registry.
      const handlers = new Map()
      service.registerIpc({
        handle(name, handler) {
          handlers.set(name, handler)
        },
      })

      const mainFrame = {
        url: "http://localhost:5173/settings",
      }
      const trustedEvent = {
        senderFrame: mainFrame,
        sender: {
          mainFrame,
        },
      }

      return handlers.get("direct-employer-sources:add-and-test")(
        trustedEvent,
        {
          name: "Example Company",
          careersUrl:
            "https://boards.greenhouse.io/examplecompany",
        },
      )
    })()

    assert.equal(added.ok, true)
    assert.equal(added.employer.platform, "greenhouse")
    assert.equal(added.employer.lastTest.available, 1)
    assert.deepEqual(requestedUrls, [
      "https://boards-api.greenhouse.io/v1/boards/examplecompany/jobs",
    ])
    assert.equal(
      requestedUrls.some((url) => url.includes("content=true")),
      false,
    )

    const sourceId = added.employer.id
    assert.equal(isDirectEmployerSourceId(sourceId), true)

    const manual = await service.searchSource(sourceId, {
      requestMode: "manual",
      keywords: "administrator",
      location: "London",
      permanent: false,
      contract: false,
      temporary: false,
      postedWithinDays: 30,
      resultsPerSource: 20,
    })

    assert.equal(manual.returned, 1)
    assert.equal(manual.jobs[0].company, "Example Company")
    assert.equal(manual.jobs[0].meta.directEmployer, true)
    assert.match(manual.jobs[0].description, /maintain accurate records/)
    assert.equal(
      requestedUrls.includes(
        "https://boards-api.greenhouse.io/v1/boards/examplecompany/jobs/42",
      ),
      true,
    )

    const automatic = await service.searchSource(sourceId, {
      requestMode: "automatic",
      keywords: "administrator",
      location: "London",
      permanent: false,
      contract: false,
      temporary: false,
      postedWithinDays: 30,
      resultsPerSource: 20,
    })

    assert.equal(automatic.skipped, true)
    assert.match(automatic.skippedReason, /Automatic Discovery permission/)
  } finally {
    global.fetch = originalFetch
    fs.rmSync(storageRoot, {
      recursive: true,
      force: true,
    })
  }
})

test("keeps the Greenhouse list request lightweight for very large boards", async () => {
  const storageRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "jobpilot-phase-9.4-large-greenhouse-"),
  )
  const originalFetch = global.fetch
  const largeDescription = "x".repeat(6 * 1024 * 1024)

  global.fetch = async (url) => {
    const safeUrl = String(url)

    assert.equal(
      safeUrl,
      "https://boards-api.greenhouse.io/v1/boards/largecompany/jobs",
    )

    return new Response(
      JSON.stringify({
        jobs: [
          {
            id: 101,
            title: "Administrator",
            updated_at: "2026-07-20T10:00:00Z",
            location: {
              name: "London, United Kingdom",
            },
            absolute_url:
              "https://boards.greenhouse.io/largecompany/jobs/101",
          },
        ],
        meta: {
          total: 1200,
        },
      }),
      {
        status: 200,
        headers: {
          "content-type": "application/json",
          "x-test-unused-full-content-bytes": String(largeDescription.length),
        },
      },
    )
  }

  try {
    const service = createDirectEmployerSourceService({
      app: { getPath: () => storageRoot },
      getErrorMessage: (error) => error?.message || String(error),
    })
    const handlers = new Map()
    service.registerIpc({
      handle: (name, handler) => handlers.set(name, handler),
    })
    const mainFrame = { url: "http://localhost:5173/settings" }
    const event = { senderFrame: mainFrame, sender: { mainFrame } }
    const added = await handlers.get(
      "direct-employer-sources:add-and-test",
    )(event, {
      name: "Large Company",
      careersUrl: "https://boards.greenhouse.io/largecompany",
    })

    assert.equal(added.ok, true)
    assert.equal(added.employer.lastTest.available, 1)
  } finally {
    global.fetch = originalFetch
    fs.rmSync(storageRoot, { recursive: true, force: true })
  }
})

test("normalises Lever postings with remote and salary information", async () => {
  const storageRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "jobpilot-phase-9.4-lever-"),
  )
  const originalFetch = global.fetch

  global.fetch = async (url) => {
    assert.match(String(url), /^https:\/\/api\.lever\.co\/v0\/postings\/examplecompany/)
    return new Response(
      JSON.stringify([
        {
          id: "lever-1",
          text: "Customer Support Specialist",
          createdAt: 1784541600000,
          hostedUrl: "https://jobs.lever.co/examplecompany/lever-1",
          descriptionPlain: "Help customers through email and live chat.",
          additionalPlain: "Remote within the United Kingdom.",
          workplaceType: "remote",
          categories: {
            location: "United Kingdom",
            team: "Customer Experience",
            commitment: "Full-time",
          },
          salaryRange: {
            currency: "GBP",
            interval: "year",
            min: 28000,
            max: 32000,
          },
        },
      ]),
      { status: 200 },
    )
  }

  try {
    const service = createDirectEmployerSourceService({
      app: { getPath: () => storageRoot },
      getErrorMessage: (error) => error?.message || String(error),
    })
    const handlers = new Map()
    service.registerIpc({ handle: (name, handler) => handlers.set(name, handler) })
    const mainFrame = { url: "http://localhost:5173/settings" }
    const event = { senderFrame: mainFrame, sender: { mainFrame } }
    const added = await handlers.get("direct-employer-sources:add-and-test")(
      event,
      {
        name: "Example Company",
        careersUrl: "https://jobs.lever.co/examplecompany",
      },
    )

    assert.equal(added.ok, true)
    const result = await service.searchSource(added.employer.id, {
      requestMode: "manual",
      keywords: "support",
      location: "remote",
      permanent: false,
      contract: false,
      temporary: false,
      postedWithinDays: 0,
      resultsPerSource: 10,
    })

    assert.equal(result.returned, 1)
    assert.equal(result.jobs[0].isRemote, true)
    assert.match(result.jobs[0].salaryText, /£28,000/)
    assert.match(result.jobs[0].description, /live chat/)
  } finally {
    global.fetch = originalFetch
    fs.rmSync(storageRoot, { recursive: true, force: true })
  }
})

test("retrieves SmartRecruiters posting details after list filtering", async () => {
  const storageRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "jobpilot-phase-9.4-smart-"),
  )
  const originalFetch = global.fetch

  global.fetch = async (url) => {
    const safeUrl = String(url)

    if (/\/postings\?limit=100&offset=0$/.test(safeUrl)) {
      return new Response(
        JSON.stringify({
          totalFound: 1,
          content: [
            {
              id: "101",
              uuid: "smart-uuid-1",
              name: "Accounts Assistant",
              releasedDate: "2026-07-21T09:00:00Z",
              company: {
                identifier: "ExampleCompany",
                name: "Example Company",
              },
              location: {
                city: "London",
                country: "gb",
                remote: false,
              },
              department: {
                label: "Finance",
              },
              typeOfEmployment: {
                label: "Full-time",
              },
            },
          ],
        }),
        { status: 200 },
      )
    }

    assert.match(safeUrl, /\/postings\/smart-uuid-1$/)
    return new Response(
      JSON.stringify({
        id: "101",
        uuid: "smart-uuid-1",
        name: "Accounts Assistant",
        releasedDate: "2026-07-21T09:00:00Z",
        applyUrl:
          "https://jobs.smartrecruiters.com/ExampleCompany/smart-uuid-1",
        company: {
          identifier: "ExampleCompany",
          name: "Example Company",
        },
        location: {
          city: "London",
          country: "gb",
          remote: false,
        },
        department: {
          label: "Finance",
        },
        typeOfEmployment: {
          label: "Full-time",
        },
        jobAd: {
          sections: {
            jobDescription: {
              text: "Maintain purchase ledgers and support month-end reporting.",
            },
            qualifications: {
              text: "Accurate spreadsheet and communication skills.",
            },
          },
        },
      }),
      { status: 200 },
    )
  }

  try {
    const service = createDirectEmployerSourceService({
      app: { getPath: () => storageRoot },
      getErrorMessage: (error) => error?.message || String(error),
    })
    const handlers = new Map()
    service.registerIpc({ handle: (name, handler) => handlers.set(name, handler) })
    const mainFrame = { url: "http://localhost:5173/settings" }
    const event = { senderFrame: mainFrame, sender: { mainFrame } }
    const added = await handlers.get("direct-employer-sources:add-and-test")(
      event,
      {
        name: "Example Company",
        careersUrl:
          "https://careers.smartrecruiters.com/ExampleCompany",
      },
    )

    assert.equal(added.ok, true)
    const result = await service.searchSource(added.employer.id, {
      requestMode: "manual",
      keywords: "accounts",
      location: "London",
      permanent: false,
      contract: false,
      temporary: false,
      postedWithinDays: 30,
      resultsPerSource: 10,
    })

    assert.equal(result.returned, 1)
    assert.match(result.jobs[0].description, /purchase ledgers/)
    assert.equal(result.jobs[0].meta.department, "Finance")
  } finally {
    global.fetch = originalFetch
    fs.rmSync(storageRoot, { recursive: true, force: true })
  }
})
