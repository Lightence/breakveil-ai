function clean(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
}

function trimSentence(value, maximum = 140) {
  const cleaned = clean(value)

  if (cleaned.length <= maximum) {
    return cleaned
  }

  return `${cleaned
    .slice(0, maximum - 1)
    .replace(/[,;:\s]+$/, "")}…`
}

function normalise(value) {
  return clean(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

function uniqueByText(values) {
  const seen = new Set()

  return values.filter((value) => {
    const key = normalise(value?.text)

    if (!key || seen.has(key)) {
      return false
    }

    seen.add(key)
    return true
  })
}

function extractVacancyFocus(job, limit = 3) {
  const role = clean(job?.role)
  const description = String(job?.description || "")

  const sentences = description
    .replace(/•/g, ". ")
    .replace(/[\r\n]+/g, ". ")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) =>
      clean(
        sentence.replace(/^[-–—\s]+/, ""),
      ),
    )
    .filter(
      (sentence) =>
        sentence.length >= 28 &&
        sentence.length <= 240,
    )

  const signalWords = [
    "responsible",
    "manage",
    "support",
    "deliver",
    "maintain",
    "coordinate",
    "handle",
    "ensure",
    "develop",
    "provide",
    "work with",
    "liaise",
    "monitor",
    "process",
  ]

  const scored = sentences
    .map((sentence, index) => {
      const lower = sentence.toLowerCase()
      let score = Math.max(0, 5 - index)

      for (const signal of signalWords) {
        if (lower.includes(signal)) {
          score += 4
        }
      }

      if (
        role &&
        lower.includes(role.toLowerCase())
      ) {
        score += 2
      }

      return {
        text: sentence,
        score,
      }
    })
    .sort(
      (first, second) =>
        second.score - first.score,
    )

  const seen = new Set()

  return scored
    .filter((item) => {
      const key = normalise(item.text)

      if (!key || seen.has(key)) {
        return false
      }

      seen.add(key)
      return true
    })
    .slice(0, limit)
    .map((item) => item.text)
}

function getRecentNewsArticles(
  report,
  limit =
    3,
) {
  const articles =
    Array.isArray(
      report?.news?.articles,
    )
      ? report.news.articles
      : []

  return articles
    .filter(
      (article) =>
        clean(
          article?.title,
        ) &&
        clean(
          article?.url,
        ),
    )
    .slice(
      0,
      limit,
    )
}

export function getResearchSource(
  report,
  sourceId,
) {
  return (
    report?.sources?.find(
      (source) => source.id === sourceId,
    ) || null
  )
}

export function getResearchSourceNumber(
  report,
  sourceId,
) {
  return (
    getResearchSource(report, sourceId)
      ?.number || null
  )
}

export function getResearchSourceNumbers(
  report,
  sourceIds = [],
) {
  return [
    ...new Set(
      sourceIds
        .map((sourceId) =>
          getResearchSourceNumber(
            report,
            sourceId,
          ),
        )
        .filter(Boolean),
    ),
  ]
}

export function buildCompanyResearchQuestions({
  report,
  job,
}) {
  if (!report) {
    return []
  }

  const companyName = clean(
    report.researchedCompanyName ||
      job?.company ||
      "the company",
  )

  const role = clean(
    job?.role || "this role",
  )

  const company = report.companiesHouse
  const vacancyFocus =
    extractVacancyFocus(job, 2)

  return uniqueByText([
    {
      text:
        `By the end of the first 90 days, what would make you confident you had hired the right person for the ${role} role?`,
      sourceIds: [],
    },

    vacancyFocus[0]
      ? {
          text:
            `The advert puts emphasis on “${trimSentence(
              vacancyFocus[0],
              105,
            )}”. What does strong performance in that area look like day to day?`,
          sourceIds: [],
        }
      : null,

    company?.sicCodes?.length
      ? {
          text:
            `Companies House lists ${companyName} under SIC code${company.sicCodes.length === 1 ? "" : "s"} ${company.sicCodes.join(", ")}. Which part of the business would this role support most closely?`,
          sourceIds: [
            "companies-house-profile",
          ],
        }
      : null,

    company?.activeOfficers?.length
      ? {
          text:
            "How does this team interact with senior leadership and the wider organisation?",
          sourceIds: [
            "companies-house-officers",
          ],
        }
      : null,

    company?.recentFilings?.length
      ? {
          text:
            "Have the team’s priorities or structure changed recently, and what would that mean for the person joining this role?",
          sourceIds: [
            "companies-house-filings",
          ],
        }
      : null,

    getRecentNewsArticles(
      report,
      1,
    )[0]
      ? {
          text:
            `I saw recent coverage titled “${trimSentence(
              getRecentNewsArticles(
                report,
                1,
              )[0].title,
              120,
            )}”. Has that development affected the team’s priorities or what you need from this role?`,

          sourceIds: [
            getRecentNewsArticles(
              report,
              1,
            )[0].sourceId,
          ],
        }
      : null,

    report?.officialWebsite?.note
      ? {
          text:
            `I noticed on the company website that ${trimSentence(
              report.officialWebsite.note,
              115,
            )}. How does that show up in the priorities of this team?`,
          sourceIds: [
            "official-company-website",
          ],
        }
      : null,

    report?.wikipedia?.summary
      ? {
          text:
            `The public overview highlights ${trimSentence(
              report.wikipedia.summary,
              115,
            )}. Which part of that wider business is most relevant to this role?`,
          sourceIds: [
            "wikipedia-overview",
          ],
        }
      : null,

    {
      text:
        `What is one challenge you would like the successful ${role} candidate to make noticeably easier in their first six months?`,
      sourceIds: [],
    },

    {
      text:
        "What tends to distinguish someone who is good in this role from someone who is excellent?",
      sourceIds: [],
    },

    {
      text:
        "What would the next stage of the process focus on, and is there anything you would recommend I prepare for?",
      sourceIds: [],
    },
  ].filter(Boolean)).slice(0, 8)
}

export function buildCompanyResearchLikelyInterviewQuestions({
  report,
  job,
}) {
  if (!report) {
    return []
  }

  const companyName = clean(
    report.researchedCompanyName ||
      job?.company ||
      "the company",
  )

  const role = clean(
    job?.role || "this role",
  )

  const vacancyFocus =
    extractVacancyFocus(job, 2)

  const industryHint =
    report.companiesHouse
      ?.sicCodes?.length
      ? `the type of work ${companyName} is registered to carry out`
      : "our business"

  return uniqueByText([
    {
      text:
        `What do you know about ${companyName}, and what made you want to apply here?`,
      sourceIds: report.companiesHouse
        ? ["companies-house-profile"]
        : report.wikipedia
          ? ["wikipedia-overview"]
          : [],
    },

    {
      text:
        `Why does the ${role} role at ${companyName} fit what you want to do next?`,
      sourceIds: [],
    },

    vacancyFocus[0]
      ? {
          text:
            `The role involves ${trimSentence(
              vacancyFocus[0],
              105,
            )}. Tell us about relevant experience you would bring to that responsibility.`,
          sourceIds: [],
        }
      : null,

    vacancyFocus[1]
      ? {
          text:
            `How would you approach ${trimSentence(
              vacancyFocus[1],
              100,
            )} if you joined us?`,
          sourceIds: [],
        }
      : null,

    report.companiesHouse?.sicCodes?.length
      ? {
          text:
            `What interests you about ${industryHint}, and how do your transferable skills fit that environment?`,
          sourceIds: [
            "companies-house-profile",
          ],
        }
      : null,

    report.officialWebsite?.note
      ? {
          text:
            `You mentioned ${companyName} in your preparation. What specifically stood out to you about the company?`,
          sourceIds: [
            "official-company-website",
          ],
        }
      : null,

    getRecentNewsArticles(
      report,
      1,
    )[0]
      ? {
          text:
            `What recent development about ${companyName} stood out to you while preparing for this interview, and why did it interest you?`,

          sourceIds: [
            getRecentNewsArticles(
              report,
              1,
            )[0].sourceId,
          ],
        }
      : null,

    {
      text:
        `What would you prioritise during your first few weeks as ${role}?`,
      sourceIds: [],
    },

    {
      text:
        "Tell us about a time you had to learn an unfamiliar process or system quickly.",
      sourceIds: [],
    },
  ].filter(Boolean)).slice(0, 7)
}

export function buildApplicationResearchMotivation({
  report,
  job,
}) {
  if (
    !report
  ) {
    return null
  }

  const companyName =
    clean(
      report.researchedCompanyName ||
        job?.company ||
        "the company",
    )

  const role =
    clean(
      job?.role ||
        "this role",
    )

  const companyPossessive =
    companyName
      .toLowerCase()
      .endsWith(
        "s",
      )
      ? `${companyName}'`
      : `${companyName}'s`

  const officialWebsite =
    report.officialWebsite ||
    null

  if (
    officialWebsite?.url &&
    officialWebsite?.note
  ) {
    const note =
      trimSentence(
        officialWebsite.note,
        135,
      ).replace(
        /[.!?]+$/,
        "",
      )

    return {
      text:
        `I spent some time looking through ${companyPossessive} official website before applying, and one thing that stood out to me was “${note}”.`,

      sourceIds: [
        "official-company-website",
      ],

      basis:
        "official-website-note",
    }
  }

  if (
    officialWebsite?.url
  ) {
    return {
      text:
        `I also looked through ${companyPossessive} official website before applying so I could get a better feel for the organisation behind the ${role} vacancy.`,

      sourceIds: [
        "official-company-website",
      ],

      basis:
        "official-website",
    }
  }

  if (
    report.companiesHouse
  ) {
    return {
      text:
        `I also took a little time to look into ${companyName} beyond the advert, including its Companies House profile, so I had a better sense of the organisation before applying.`,

      sourceIds: [
        "companies-house-profile",
      ],

      basis:
        "companies-house",
    }
  }

  if (
    Array.isArray(
      report.news?.articles,
    ) &&
    report.news.articles.length >
      0
  ) {
    return {
      text:
        `I also looked into ${companyName} beyond the advert, including some recent company coverage, so I could understand a little more about the wider organisation before applying.`,

      sourceIds:
        report.news.articles
          .slice(
            0,
            1,
          )
          .map(
            (article) =>
              article.sourceId,
          )
          .filter(
            Boolean,
          ),

      basis:
        "recent-news-context",
    }
  }

  if (
    report.wikipedia
      ?.summary
  ) {
    return {
      text:
        `I also spent some time reading about ${companyName} beyond the vacancy so I could understand the organisation a little better before applying for the ${role} role.`,

      sourceIds: [
        "wikipedia-overview",
      ],

      basis:
        "public-overview-context",
    }
  }

  if (
    Array.isArray(
      report.sources,
    ) &&
    report.sources.length >
      0
  ) {
    return {
      text:
        `I also took time to look into ${companyName} beyond the vacancy so I could understand the organisation a little better before applying.`,

      sourceIds:
        [],

      basis:
        "saved-research",
    }
  }

  return null
}

export function buildCompanyResearchQuickBrief({
  report,
  job,
}) {
  if (!report) {
    return []
  }

  const company =
    report.companiesHouse

  const companyName =
    clean(
      report.researchedCompanyName ||
        job?.company ||
        "the company",
    )

  const items =
    []

  if (
    company?.status ||
    company?.companyType
  ) {
    items.push({
      text:
        company?.status &&
        company?.companyType
          ? `${companyName} is listed by Companies House as a ${company.status.toLowerCase()} ${company.companyType.toLowerCase()}.`
          : company?.status
            ? `${companyName} is listed by Companies House as ${company.status.toLowerCase()}.`
            : `${companyName} is registered as ${company.companyType.toLowerCase()}.`,

      sourceIds: [
        "companies-house-profile",
      ],
    })
  }

  if (
    report.officialWebsite
      ?.note
  ) {
    items.push({
      text:
        trimSentence(
          report.officialWebsite.note,
          145,
        ),

      sourceIds: [
        "official-company-website",
      ],
    })
  } else if (
    report.wikipedia
      ?.summary
  ) {
    items.push({
      text:
        trimSentence(
          report.wikipedia.summary,
          145,
        ),

      sourceIds: [
        "wikipedia-overview",
      ],
    })
  } else if (
    company?.sicCodes
      ?.length
  ) {
    items.push({
      text:
        `Companies House lists SIC code${company.sicCodes.length === 1 ? "" : "s"} ${company.sicCodes.join(", ")} for the registered company.`,

      sourceIds: [
        "companies-house-profile",
      ],
    })
  }

  const recentNews =
    getRecentNewsArticles(
      report,
      1,
    )[0]

  if (
    recentNews
  ) {
    items.push({
      text:
        `Recent selected coverage: “${trimSentence(
          recentNews.title,
          125,
        )}” — ${recentNews.domain || "news publication"}.`,

      sourceIds: [
        recentNews.sourceId,
      ],
    })
  } else if (
    company?.recentFilings
      ?.length
  ) {
    const filing =
      company.recentFilings[0]

    items.push({
      text:
        `Latest filing in this snapshot: ${getFriendlyFilingDescription(
          filing,
        )}${filing.date ? ` (${filing.date})` : ""}.`,

      sourceIds: [
        "companies-house-filings",
      ],
    })
  }

  return items.slice(
    0,
    3,
  )
}

export function buildCompanyResearchTalkingPoints({
  report,
  job,
}) {
  if (!report) {
    return []
  }

  const companyName = clean(
    report.researchedCompanyName ||
      job?.company ||
      "the company",
  )

  const company = report.companiesHouse
  const points = []

  if (company?.status && company?.companyType) {
    points.push({
      text:
        `${companyName} is listed by Companies House as a ${company.status.toLowerCase()} ${company.companyType.toLowerCase()}.`,
      sourceIds: [
        "companies-house-profile",
      ],
    })
  } else if (company?.status) {
    points.push({
      text:
        `${companyName} is listed by Companies House as ${company.status.toLowerCase()}.`,
      sourceIds: [
        "companies-house-profile",
      ],
    })
  }

  if (company?.incorporationDate) {
    points.push({
      text:
        `The registered company was incorporated on ${company.incorporationDate}.`,
      sourceIds: [
        "companies-house-profile",
      ],
    })
  }

  if (company?.sicCodes?.length) {
    points.push({
      text:
        `Companies House lists SIC code${company.sicCodes.length === 1 ? "" : "s"} ${company.sicCodes.join(", ")}.`,
      sourceIds: [
        "companies-house-profile",
      ],
    })
  }

  if (company?.activeOfficers?.length) {
    points.push({
      text:
        `${company.activeOfficers.length} current officer record${company.activeOfficers.length === 1 ? " was" : "s were"} returned in this snapshot.`,
      sourceIds: [
        "companies-house-officers",
      ],
    })
  }

  if (report.officialWebsite?.note) {
    points.push({
      text:
        report.officialWebsite.note,
      sourceIds: [
        "official-company-website",
      ],
    })
  }

  const recentNews =
    getRecentNewsArticles(
      report,
      1,
    )[0]

  if (
    recentNews
  ) {
    points.push({
      text:
        `Recent selected coverage includes “${trimSentence(
          recentNews.title,
          150,
        )}” from ${recentNews.domain || "a news publication"}.`,

      sourceIds: [
        recentNews.sourceId,
      ],
    })
  }

  if (report.wikipedia?.summary) {
    points.push({
      text:
        trimSentence(
          report.wikipedia.summary,
          190,
        ),
      sourceIds: [
        "wikipedia-overview",
      ],
    })
  }

  return points.slice(0, 5)
}

function titleCaseWords(
  value,
) {
  return clean(
    value,
  )
    .replace(
      /[_-]+/g,
      " ",
    )
    .replace(
      /\b\w/g,
      (character) =>
        character.toUpperCase(),
    )
}

export function getFriendlyFilingDescription(
  filing,
) {
  const description =
    clean(
      filing?.description,
    )

  const type =
    clean(
      filing?.type,
    )

  const category =
    clean(
      filing?.category,
    )

  if (
    description
  ) {
    return titleCaseWords(
      description,
    )
  }

  if (
    category &&
    type
  ) {
    return `${titleCaseWords(
      category,
    )} (${type})`
  }

  return (
    titleCaseWords(
      category ||
      type,
    ) ||
    "Company Filing"
  )
}

function daysBetween(
  fromValue,
  toValue,
) {
  const from =
    new Date(
      fromValue,
    )

  const to =
    new Date(
      toValue,
    )

  if (
    Number.isNaN(
      from.getTime(),
    ) ||
    Number.isNaN(
      to.getTime(),
    )
  ) {
    return null
  }

  return Math.round(
    (
      to.getTime() -
      from.getTime()
    ) /
      86400000,
  )
}

export function buildCompaniesHouseSignals({
  report,
}) {
  const company =
    report?.companiesHouse

  if (
    !company
  ) {
    return []
  }

  const referenceDate =
    report?.refreshedAt ||
    report?.createdAt ||
    new Date()
      .toISOString()

  const signals =
    []

  if (
    company.status
  ) {
    signals.push({
      id:
        "company-status",

      label:
        "Register Status",

      value:
        company.status,

      detail:
        "Status reported by Companies House for this snapshot.",

      tone:
        company.status
          .toLowerCase() ===
          "active"
          ? "success"
          : "warning",

      sourceIds: [
        "companies-house-profile",
      ],
    })
  }

  if (
    company.accounts
  ) {
    const daysUntil =
      daysBetween(
        referenceDate,
        company.accounts
          .nextDue,
      )

    signals.push({
      id:
        "accounts",

      label:
        "Accounts",

      value:
        company.accounts
          .overdue
          ? "Overdue"
          : company.accounts
              .nextDue
            ? "Filed / Next Due"
            : "Status Available",

      detail:
        company.accounts
          .overdue
          ? `Companies House marked the accounts as overdue at the time of this snapshot${company.accounts.nextDue ? `; due ${company.accounts.nextDue}` : ""}.`
          : company.accounts
              .nextDue
            ? `Next accounts due ${company.accounts.nextDue}${daysUntil !== null && daysUntil >= 0 ? ` (${daysUntil} day${daysUntil === 1 ? "" : "s"} from this snapshot)` : ""}.`
            : company.accounts
                .lastMadeUpTo
              ? `Latest accounts made up to ${company.accounts.lastMadeUpTo}.`
              : "Companies House returned an accounts record.",

      tone:
        company.accounts
          .overdue
          ? "danger"
          : daysUntil !==
                null &&
              daysUntil >=
                0 &&
              daysUntil <=
                90
            ? "warning"
            : "success",

      sourceIds: [
        "companies-house-profile",
      ],
    })
  }

  if (
    company.confirmationStatement
  ) {
    const daysUntil =
      daysBetween(
        referenceDate,
        company
          .confirmationStatement
          .nextDue,
      )

    signals.push({
      id:
        "confirmation-statement",

      label:
        "Confirmation Statement",

      value:
        company
          .confirmationStatement
          .overdue
          ? "Overdue"
          : company
              .confirmationStatement
              .nextDue
            ? "Current / Next Due"
            : "Status Available",

      detail:
        company
          .confirmationStatement
          .overdue
          ? `Companies House marked the confirmation statement as overdue at the time of this snapshot${company.confirmationStatement.nextDue ? `; due ${company.confirmationStatement.nextDue}` : ""}.`
          : company
              .confirmationStatement
              .nextDue
            ? `Next confirmation statement due ${company.confirmationStatement.nextDue}${daysUntil !== null && daysUntil >= 0 ? ` (${daysUntil} day${daysUntil === 1 ? "" : "s"} from this snapshot)` : ""}.`
            : company
                .confirmationStatement
                .lastMadeUpTo
              ? `Latest statement made up to ${company.confirmationStatement.lastMadeUpTo}.`
              : "Companies House returned a confirmation-statement record.",

      tone:
        company
          .confirmationStatement
          .overdue
          ? "danger"
          : daysUntil !==
                null &&
              daysUntil >=
                0 &&
              daysUntil <=
                45
            ? "warning"
            : "success",

      sourceIds: [
        "companies-house-profile",
      ],
    })
  }

  signals.push({
    id:
      "insolvency",

    label:
      "Insolvency History",

    value:
      company
        .hasInsolvencyHistory
        ? "Recorded"
        : "Not Flagged",

    detail:
      company
        .hasInsolvencyHistory
        ? "The Companies House profile reports insolvency history. Review the official register before drawing conclusions."
        : "The Companies House profile did not flag insolvency history in this snapshot.",

    tone:
      company
        .hasInsolvencyHistory
        ? "warning"
        : "neutral",

    sourceIds: [
      "companies-house-profile",
    ],
  })

  const filings =
    Array.isArray(
      company.recentFilings,
    )
      ? company.recentFilings
      : []

  if (
    filings.length >
    0
  ) {
    const categories =
      [
        ...new Set(
          filings
            .map(
              (filing) =>
                clean(
                  filing.category,
                ),
            )
            .filter(
              Boolean,
            ),
        ),
      ]

    signals.push({
      id:
        "filing-activity",

      label:
        "Recent Filing Activity",

      value:
        `${filings.length} Recent Filing${filings.length === 1 ? "" : "s"}`,

      detail:
        categories.length >
        0
          ? `Recent sample includes ${categories.join(", ")}.`
          : "Recent Companies House filing entries are available.",

      tone:
        "document",

      sourceIds: [
        "companies-house-filings",
      ],
    })
  }

  return signals
}

export function buildCompanyResearchRoleRelevance({
  report,
  job,
}) {
  if (
    !report
  ) {
    return []
  }

  const companyName =
    clean(
      report.researchedCompanyName ||
      job?.company ||
      "the company",
    )

  const role =
    clean(
      job?.role ||
      "this role",
    )

  const vacancyFocus =
    extractVacancyFocus(
      job,
      2,
    )

  const recentNews =
    getRecentNewsArticles(
      report,
      2,
    )

  const interpretations =
    []

  if (
    vacancyFocus[0]
  ) {
    interpretations.push({
      title:
        "Vacancy Priority",

      text:
        `The advert places noticeable emphasis on “${trimSentence(
          vacancyFocus[0],
          125,
        )}”. That is worth preparing a specific example for before interviewing.`,

      sourceIds:
        [],
    })
  }

  if (
    report.companiesHouse
      ?.sicCodes
      ?.length
  ) {
    interpretations.push({
      title:
        "Business Context",

      text:
        `${companyName}’s registered SIC code${report.companiesHouse.sicCodes.length === 1 ? "" : "s"} provide useful business context for the ${role} role, but they describe the registered company rather than the exact team or vacancy.`,

      sourceIds: [
        "companies-house-profile",
      ],
    })
  }

  if (
    recentNews.length >
    0
  ) {
    interpretations.push({
      title:
        "Current Context",

      text:
        `Recent reporting about ${companyName} may help you ask a timely question about current priorities. Treat the article as third-party reporting and read the original before using it in an interview.`,

      sourceIds:
        recentNews.map(
          (article) =>
            article.sourceId,
        ),
    })
  }

  if (
    report.officialWebsite
      ?.note
  ) {
    interpretations.push({
      title:
        "Motivation Angle",

      text:
        "Your saved official-website note can help make a ‘Why this company?’ answer more specific, provided the wording still reflects what the source actually says.",

      sourceIds: [
        "official-company-website",
      ],
    })
  }

  return interpretations.slice(
    0,
    4,
  )
}

export function formatResearchDate(value) {
  if (!value) {
    return ""
  }

  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    return ""
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      dateStyle: "medium",
      timeStyle: "short",
    },
  ).format(parsed)
}

export function mergeResearchHistory({
  currentReport,
  history = [],
}) {
  const safeHistory =
    Array.isArray(history)
      ? history
      : []

  if (!currentReport?.researchId) {
    return safeHistory.slice(0, 5)
  }

  return [
    currentReport,
    ...safeHistory.filter(
      (report) =>
        report?.researchId !==
        currentReport.researchId,
    ),
  ].slice(0, 5)
}
