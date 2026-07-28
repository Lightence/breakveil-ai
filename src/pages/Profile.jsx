import {
  useEffect,
  useId,
  useMemo,
  useState,
} from "react"

import {
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  FileText,
  Gauge,
  Mail,
  MapPin,
  Phone,
  RotateCcw,
  Save,
  SearchCheck,
  ShieldCheck,
  Sparkles,
  Target,
  UserRound,
  WalletCards,
} from "lucide-react"

const profileStorageKey =
  "jobpilot.candidate-profile"

const workModeOptions = [
  "On-site",
  "Hybrid",
  "Remote",
]

const contractTypeOptions = [
  "Permanent",
  "Full-time",
  "Part-time",
  "Contract",
  "Temporary",
]

const emptyForm = {
  fullName: "",
  preferredName: "",
  email: "",
  phone: "",
  location: "",
  linkedin: "",
  portfolio: "",

  currentJobTitle: "",
  targetRoles: "",
  preferredLocations: "",
  minimumSalary: "",
  workModes: "",
  contractTypes: "",

  skills: "",
  professionalSummary: "",
  strengths: "",
  whyThisRole: "",

  availability: "",
  noticePeriod: "",
  earliestStartDate: "",
  rightToWork: "",
  drivingLicence: "",
  additionalInformation: "",
}

function readStoredProfile() {
  try {
    const savedValue =
      localStorage.getItem(
        profileStorageKey,
      )

    const parsedValue =
      savedValue
        ? JSON.parse(
            savedValue,
          )
        : {}

    return parsedValue &&
      typeof parsedValue ===
        "object" &&
      !Array.isArray(
        parsedValue,
      )
      ? parsedValue
      : {}
  } catch {
    return {}
  }
}

function createForm(
  profile,
) {
  const savedLocation =
    profile.location ||
    profile.town ||
    profile.city ||
    ""

  return {
    ...emptyForm,

    fullName:
      profile.fullName ||
      "",

    preferredName:
      profile.preferredName ||
      "",

    email:
      profile.email ||
      "",

    phone:
      profile.phone ||
      "",

    location:
      savedLocation,

    linkedin:
      profile.linkedin ||
      "",

    portfolio:
      profile.portfolio ||
      profile.website ||
      "",

    currentJobTitle:
      profile.currentJobTitle ||
      "",

    targetRoles:
      normaliseListText(
        profile.targetRoles,
      ),

    preferredLocations:
      normaliseListText(
        profile.preferredLocations,
      ),

    minimumSalary:
      String(
        profile.minimumSalary ||
          "",
      ),

    workModes:
      normaliseListText(
        profile.workModes,
      ),

    contractTypes:
      normaliseListText(
        profile.contractTypes ||
          profile.employmentTypes,
      ),

    skills:
      normaliseListText(
        profile.skills,
      ),

    professionalSummary:
      profile.professionalSummary ||
      profile.profileSummary ||
      "",

    strengths:
      normaliseListText(
        profile.strengths,
      ),

    whyThisRole:
      profile.whyThisRole ||
      "",

    availability:
      profile.availability ||
      "",

    noticePeriod:
      profile.noticePeriod ||
      "",

    earliestStartDate:
      profile.earliestStartDate ||
      "",

    rightToWork:
      profile.rightToWork ||
      "",

    drivingLicence:
      profile.drivingLicence ||
      "",

    additionalInformation:
      profile.additionalInformation ||
      "",
  }
}

function normaliseListText(
  value,
) {
  if (
    Array.isArray(
      value,
    )
  ) {
    return value
      .map(
        (item) =>
          String(
            item ||
              "",
          ).trim(),
      )
      .filter(Boolean)
      .join("\n")
  }

  return String(
    value ||
      "",
  )
}

function splitValues(
  value,
) {
  return String(
    value ||
      "",
  )
    .split(
      /[\n,;|]/,
    )
    .map(
      (item) =>
        item.trim(),
    )
    .filter(Boolean)
}

function uniqueValues(
  values,
) {
  return [
    ...new Set(
      values
        .map(
          (value) =>
            String(
              value ||
                "",
            ).trim(),
        )
        .filter(Boolean),
    ),
  ]
}

function cleanForm(
  form,
) {
  const cleaned =
    Object.fromEntries(
      Object.entries(
        form,
      ).map(
        ([
          key,
          value,
        ]) => [
          key,
          typeof value ===
            "string"
            ? value.trim()
            : value,
        ],
      ),
    )

  cleaned.targetRoles =
    uniqueValues(
      splitValues(
        cleaned.targetRoles,
      ),
    ).join("\n")

  cleaned.preferredLocations =
    uniqueValues(
      splitValues(
        cleaned.preferredLocations,
      ),
    ).join("\n")

  cleaned.workModes =
    uniqueValues(
      splitValues(
        cleaned.workModes,
      ),
    ).join("\n")

  cleaned.contractTypes =
    uniqueValues(
      splitValues(
        cleaned.contractTypes,
      ),
    ).join("\n")

  cleaned.skills =
    uniqueValues(
      splitValues(
        cleaned.skills,
      ),
    ).join("\n")

  cleaned.strengths =
    uniqueValues(
      splitValues(
        cleaned.strengths,
      ),
    ).join("\n")

  cleaned.minimumSalary =
    String(
      cleaned.minimumSalary ||
        "",
    ).replace(
      /[^0-9.]/g,
      "",
    )

  return cleaned
}

function profilesMatch(
  first,
  second,
) {
  return (
    JSON.stringify(
      first,
    ) ===
    JSON.stringify(
      second,
    )
  )
}

function validEmail(
  value,
) {
  const email =
    String(
      value ||
        "",
    ).trim()

  return (
    !email ||
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      email,
    )
  )
}

function validWebAddress(
  value,
) {
  const address =
    String(
      value ||
        "",
    ).trim()

  if (!address) {
    return true
  }

  try {
    new URL(
      address.startsWith(
        "http://",
      ) ||
        address.startsWith(
          "https://",
        )
        ? address
        : `https://${address}`,
    )

    return true
  } catch {
    return false
  }
}

function formatSalary(
  value,
) {
  const amount =
    Number(
      String(
        value ||
          "",
      ).replace(
        /[^0-9.]/g,
        "",
      ),
    )

  if (
    !Number.isFinite(
      amount,
    ) ||
    amount <= 0
  ) {
    return "Not set"
  }

  return new Intl.NumberFormat(
    "en-GB",
    {
      style:
        "currency",

      currency:
        "GBP",

      maximumFractionDigits:
        0,
    },
  ).format(
    amount,
  )
}

function getInitials(
  profile,
) {
  const name =
    String(
      profile.preferredName ||
        profile.fullName ||
        "",
    ).trim()

  if (!name) {
    return "JP"
  }

  return name
    .split(
      /\s+/,
    )
    .slice(
      0,
      2,
    )
    .map(
      (part) =>
        part[0]
          ?.toUpperCase(),
    )
    .join("")
}

function getCompletion(
  form,
) {
  const checks = [
    {
      label:
        "Your name",
      complete:
        Boolean(
          form.fullName.trim() ||
            form.preferredName.trim(),
        ),
    },
    {
      label:
        "Email address",
      complete:
        Boolean(
          form.email.trim(),
        ),
    },
    {
      label:
        "Phone number",
      complete:
        Boolean(
          form.phone.trim(),
        ),
    },
    {
      label:
        "Base location",
      complete:
        Boolean(
          form.location.trim(),
        ),
    },
    {
      label:
        "Current job title",
      complete:
        Boolean(
          form.currentJobTitle.trim(),
        ),
    },
    {
      label:
        "Target roles",
      complete:
        splitValues(
          form.targetRoles,
        ).length >
        0,
    },
    {
      label:
        "Preferred Locations",
      complete:
        splitValues(
          form.preferredLocations,
        ).length >
        0,
    },
    {
      label:
        "Minimum Salary",
      complete:
        Boolean(
          form.minimumSalary.trim(),
        ),
    },
    {
      label:
        "Work modes",
      complete:
        splitValues(
          form.workModes,
        ).length >
        0,
    },
    {
      label:
        "Skills",
      complete:
        splitValues(
          form.skills,
        ).length >=
        3,
    },
    {
      label:
        "Professional summary",
      complete:
        form.professionalSummary
          .trim().length >=
        40,
    },
    {
      label:
        "Strengths",
      complete:
        splitValues(
          form.strengths,
        ).length >=
        2,
    },
    {
      label:
        "Role motivation",
      complete:
        form.whyThisRole
          .trim().length >=
        20,
    },
    {
      label:
        "Availability",
      complete:
        Boolean(
          form.availability.trim() ||
            form.noticePeriod.trim() ||
            form.earliestStartDate.trim(),
        ),
    },
  ]

  const completed =
    checks.filter(
      (check) =>
        check.complete,
    ).length

  return {
    checks,

    completed,

    total:
      checks.length,

    percentage:
      Math.round(
        (
          completed /
          checks.length
        ) *
          100,
      ),
  }
}

export default function Profile() {
  const initialProfile =
    useMemo(
      readStoredProfile,
      [],
    )

  const [
    storedProfile,
    setStoredProfile,
  ] = useState(
    initialProfile,
  )

  const [
    form,
    setForm,
  ] = useState(
    () =>
      createForm(
        initialProfile,
      ),
  )

  const [
    message,
    setMessage,
  ] = useState("")

  const [
    error,
    setError,
  ] = useState("")

  const cleanedForm =
    useMemo(
      () =>
        cleanForm(
          form,
        ),
      [form],
    )

  const savedForm =
    useMemo(
      () =>
        cleanForm(
          createForm(
            storedProfile,
          ),
        ),
      [storedProfile],
    )

  const dirty =
    !profilesMatch(
      cleanedForm,
      savedForm,
    )

  const completion =
    useMemo(
      () =>
        getCompletion(
          form,
        ),
      [form],
    )

  const errors =
    useMemo(
      () => {
        const nextErrors =
          {}

        if (
          !validEmail(
            form.email,
          )
        ) {
          nextErrors.email =
            "Enter a valid email address."
        }

        if (
          !validWebAddress(
            form.linkedin,
          )
        ) {
          nextErrors.linkedin =
            "Enter a valid LinkedIn address."
        }

        if (
          !validWebAddress(
            form.portfolio,
          )
        ) {
          nextErrors.portfolio =
            "Enter a valid portfolio address."
        }

        return nextErrors
      },
      [
        form.email,
        form.linkedin,
        form.portfolio,
      ],
    )

  const hasErrors =
    Object.keys(
      errors,
    ).length >
    0

  useEffect(() => {
    function warnBeforeClose(
      event,
    ) {
      if (!dirty) {
        return
      }

      event.preventDefault()
      event.returnValue =
        ""
    }

    window.addEventListener(
      "beforeunload",
      warnBeforeClose,
    )

    return () => {
      window.removeEventListener(
        "beforeunload",
        warnBeforeClose,
      )
    }
  }, [dirty])

  function updateField(
    field,
    value,
  ) {
    setForm(
      (current) => ({
        ...current,

        [field]:
          value,
      }),
    )

    setMessage("")
    setError("")
  }

  function toggleListOption(
    field,
    option,
  ) {
    setForm(
      (current) => {
        const values =
          splitValues(
            current[
              field
            ],
          )

        const nextValues =
          values.includes(
            option,
          )
            ? values.filter(
                (value) =>
                  value !==
                  option,
              )
            : [
                ...values,
                option,
              ]

        return {
          ...current,

          [field]:
            nextValues.join(
              "\n",
            ),
        }
      },
    )

    setMessage("")
    setError("")
  }

  function saveProfile(
    event,
  ) {
    event?.preventDefault()

    if (hasErrors) {
      setError(
        "Correct the highlighted profile fields before saving.",
      )

      return
    }

    const now =
      new Date()
        .toISOString()

    const nextProfile = {
      ...storedProfile,
      ...cleanedForm,

      city:
        cleanedForm.location,

      town:
        cleanedForm.location,

      location:
        cleanedForm.location,

      employmentTypes:
        cleanedForm.contractTypes,

      profileVersion:
        2,

      updatedAt:
        now,
    }

    try {
      localStorage.setItem(
        profileStorageKey,
        JSON.stringify(
          nextProfile,
        ),
      )

      setStoredProfile(
        nextProfile,
      )

      setForm(
        createForm(
          nextProfile,
        ),
      )

      setMessage(
        "Candidate Profile saved. Job matching, discovery and tailored application content will use the updated details.",
      )

      setError("")

      window.dispatchEvent(
        new Event(
          "jobpilot:profile-updated",
        ),
      )
    } catch {
      setError(
        "BreakVeil could not save the Candidate Profile.",
      )
    }
  }

  function resetChanges() {
    setForm(
      createForm(
        storedProfile,
      ),
    )

    setMessage(
      "Unsaved profile changes were discarded.",
    )

    setError("")
  }

  const targetRoleCount =
    splitValues(
      form.targetRoles,
    ).length

  const locationCount =
    splitValues(
      form.preferredLocations,
    ).length

  const skillCount =
    splitValues(
      form.skills,
    ).length

  return (
    <form
      onSubmit={
        saveProfile
      }
      className="min-w-0 pb-28"
    >
      <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
        <div>
          <p className="text-sm font-medium text-zinc-500">
            Your Job-Search Profile
          </p>

          <h1 className="mt-1 text-3xl font-bold tracking-tight">
            Candidate Profile
          </h1>

          <p className="mt-2 max-w-2xl text-zinc-400">
            Manage the details BreakVeil uses for job matching, discovery and application preparation.
          </p>
        </div>

        <button
          type="submit"
          disabled={
            !dirty ||
            hasErrors
          }
          className="inline-flex w-fit shrink-0 items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
        >
          <Save
            size={17}
          />
          Save profile
        </button>
      </header>

      {message && (
        <div className="mt-6 flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-200">
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
        <div className="mt-6 flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
          <ShieldCheck
            size={17}
            className="mt-0.5 shrink-0"
          />

          <span>
            {error}
          </span>
        </div>
      )}

      <section className="mt-8">
        <ProfileOverviewCard
          form={
            form
          }
          completion={
            completion
          }
          roleCount={
            targetRoleCount
          }
          locationCount={
            locationCount
          }
          skillCount={
            skillCount
          }
          minimumSalary={
            form.minimumSalary
          }
        />
      </section>

      <div className="jp-grid-sidebar mt-6 gap-6">
        <div className="space-y-6">
          <ProfileSection
            icon={
              UserRound
            }
            title="Personal Details"
            description="Your identity, contact information and professional links."
            defaultOpen
          >
            <div className="grid gap-4 md:grid-cols-2">
              <Field
                label="Full name"
                help="The name that should appear on formal applications."
              >
                <input
                  autoComplete="name"
                  value={
                    form.fullName
                  }
                  onChange={(event) =>
                    updateField(
                      "fullName",
                      event.target.value,
                    )
                  }
                  placeholder="Alex Morgan"
                  className={
                    inputClass
                  }
                />
              </Field>

              <Field
                label="Preferred name"
                help="Used for greetings and less formal wording."
              >
                <input
                  value={
                    form.preferredName
                  }
                  onChange={(event) =>
                    updateField(
                      "preferredName",
                      event.target.value,
                    )
                  }
                  placeholder="Alex"
                  className={
                    inputClass
                  }
                />
              </Field>

              <Field
                label="Email address"
                error={
                  errors.email
                }
              >
                <input
                  type="email"
                  autoComplete="email"
                  value={
                    form.email
                  }
                  onChange={(event) =>
                    updateField(
                      "email",
                      event.target.value,
                    )
                  }
                  placeholder="alex@example.com"
                  className={
                    fieldClass(
                      errors.email,
                    )
                  }
                />
              </Field>

              <Field label="Phone number">
                <input
                  autoComplete="tel"
                  value={
                    form.phone
                  }
                  onChange={(event) =>
                    updateField(
                      "phone",
                      event.target.value,
                    )
                  }
                  placeholder="07123 456789"
                  className={
                    inputClass
                  }
                />
              </Field>

              <Field
                label="Current location"
                help="Used as the starting point for local job searches."
              >
                <input
                  value={
                    form.location
                  }
                  onChange={(event) =>
                    updateField(
                      "location",
                      event.target.value,
                    )
                  }
                  placeholder="Preston"
                  className={
                    inputClass
                  }
                />
              </Field>

              <Field
                label="LinkedIn"
                error={
                  errors.linkedin
                }
              >
                <input
                  value={
                    form.linkedin
                  }
                  onChange={(event) =>
                    updateField(
                      "linkedin",
                      event.target.value,
                    )
                  }
                  placeholder="linkedin.com/in/your-name"
                  className={
                    fieldClass(
                      errors.linkedin,
                    )
                  }
                />
              </Field>
            </div>

            <div className="mt-4">
              <Field
                label="Portfolio or professional website"
                error={
                  errors.portfolio
                }
              >
                <input
                  value={
                    form.portfolio
                  }
                  onChange={(event) =>
                    updateField(
                      "portfolio",
                      event.target.value,
                    )
                  }
                  placeholder="yourportfolio.co.uk"
                  className={
                    fieldClass(
                      errors.portfolio,
                    )
                  }
                />
              </Field>
            </div>
          </ProfileSection>

          <ProfileSection
            icon={
              Target
            }
            title="Job Preferences"
            description="The roles, locations and working arrangements BreakVeil should prioritise."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <Field
                label="Current or most recent role"
                help="Provides extra context for matching and tailored writing."
              >
                <input
                  value={
                    form.currentJobTitle
                  }
                  onChange={(event) =>
                    updateField(
                      "currentJobTitle",
                      event.target.value,
                    )
                  }
                  placeholder="Shift Supervisor"
                  className={
                    inputClass
                  }
                />
              </Field>

              <Field
                label="Minimum Salary"
                help="Enter the lowest annual salary you would normally consider."
              >
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500">
                    £
                  </span>

                  <input
                    inputMode="decimal"
                    value={
                      form.minimumSalary
                    }
                    onChange={(event) =>
                      updateField(
                        "minimumSalary",
                        event.target.value,
                      )
                    }
                    placeholder="26000"
                    className={`${inputClass} pl-7`}
                  />
                </div>
              </Field>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <ListField
                label="Target job titles"
                help="Add one job title per line so BreakVeil knows what to search for."
                value={
                  form.targetRoles
                }
                onChange={(value) =>
                  updateField(
                    "targetRoles",
                    value,
                  )
                }
                placeholder={"Administrator\nAccounts Assistant\nCustomer Service Representative"}
              />

              <ListField
                label="Preferred Locations"
                help="Add towns, cities or Remote, one per line."
                value={
                  form.preferredLocations
                }
                onChange={(value) =>
                  updateField(
                    "preferredLocations",
                    value,
                  )
                }
                placeholder={"Preston\nBlackpool\nManchester\nRemote"}
              />
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              <OptionGroup
                label="Workplace Preferences"
                options={
                  workModeOptions
                }
                selected={
                  splitValues(
                    form.workModes,
                  )
                }
                onToggle={(option) =>
                  toggleListOption(
                    "workModes",
                    option,
                  )
                }
              />

              <OptionGroup
                label="Employment Preferences"
                options={
                  contractTypeOptions
                }
                selected={
                  splitValues(
                    form.contractTypes,
                  )
                }
                onToggle={(option) =>
                  toggleListOption(
                    "contractTypes",
                    option,
                  )
                }
              />
            </div>
          </ProfileSection>

          <ProfileSection
            icon={
              Sparkles
            }
            title="Skills and Experience"
            description="The experience and strengths BreakVeil uses when comparing you with a vacancy."
          >
            <ListField
              label="Skills and Tools"
              help="Add practical skills, software and systems you have genuinely used."
              value={
                form.skills
              }
              onChange={(value) =>
                updateField(
                  "skills",
                  value,
                )
              }
              placeholder={"Customer service\nData entry\nMicrosoft Excel\nRecord keeping\nComplaint handling"}
              rows={
                7
              }
            />

            <div className="mt-5">
              <LongTextField
                label="Professional Profile"
                help="A reusable summary of your experience, working style and strengths."
                value={
                  form.professionalSummary
                }
                onChange={(value) =>
                  updateField(
                    "professionalSummary",
                    value,
                  )
                }
                placeholder="Summarise your experience, working style and strongest areas..."
                minimum={
                  40
                }
              />
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              <ListField
                label="Key Strengths"
                help="Add strengths you can support with real examples."
                value={
                  form.strengths
                }
                onChange={(value) =>
                  updateField(
                    "strengths",
                    value,
                  )
                }
                placeholder={"Clear communication\nAccurate record keeping\nCalm under pressure"}
                rows={
                  6
                }
              />

              <LongTextField
                label="What you want from your next role"
                help="Used as general motivation when preparing tailored applications."
                value={
                  form.whyThisRole
                }
                onChange={(value) =>
                  updateField(
                    "whyThisRole",
                    value,
                  )
                }
                placeholder="Explain the type of work, environment and progression you are looking for..."
                minimum={
                  20
                }
                rows={
                  6
                }
              />
            </div>
          </ProfileSection>

          <ProfileSection
            icon={
              Clock3
            }
            title="Availability and Practical Information"
            description="Reusable details for application questions and recruiter communication."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <Field
                label="Working Availability"
                help="Add the days, times or working patterns you can normally accept."
              >
                <textarea
                  rows="4"
                  value={
                    form.availability
                  }
                  onChange={(event) =>
                    updateField(
                      "availability",
                      event.target.value,
                    )
                  }
                  placeholder="Available weekdays from midday..."
                  className={`${inputClass} h-auto resize-y py-3 leading-6`}
                />
              </Field>

              <div className="grid gap-4">
                <Field label="Notice period">
                  <input
                    value={
                      form.noticePeriod
                    }
                    onChange={(event) =>
                      updateField(
                        "noticePeriod",
                        event.target.value,
                      )
                    }
                    placeholder="Two weeks"
                    className={
                      inputClass
                    }
                  />
                </Field>

                <Field label="Earliest start date">
                  <input
                    type="date"
                    value={
                      form.earliestStartDate
                    }
                    onChange={(event) =>
                      updateField(
                        "earliestStartDate",
                        event.target.value,
                      )
                    }
                    className={
                      inputClass
                    }
                  />
                </Field>
              </div>

              <Field label="Right to work">
                <input
                  value={
                    form.rightToWork
                  }
                  onChange={(event) =>
                    updateField(
                      "rightToWork",
                      event.target.value,
                    )
                  }
                  placeholder="For example: Full right to work in the UK"
                  className={
                    inputClass
                  }
                />
              </Field>

              <Field label="Driving and Travel">
                <input
                  value={
                    form.drivingLicence
                  }
                  onChange={(event) =>
                    updateField(
                      "drivingLicence",
                      event.target.value,
                    )
                  }
                  placeholder="For example: Full UK licence"
                  className={
                    inputClass
                  }
                />
              </Field>
            </div>

            <div className="mt-4">
              <Field
                label="Additional Application Information"
                help="Only include information you are comfortable reusing in applications."
              >
                <textarea
                  rows="5"
                  value={
                    form.additionalInformation
                  }
                  onChange={(event) =>
                    updateField(
                      "additionalInformation",
                      event.target.value,
                    )
                  }
                  placeholder="Add other practical information that may help with applications..."
                  className={`${inputClass} h-auto resize-y py-3 leading-6`}
                />
              </Field>
            </div>
          </ProfileSection>
        </div>

        <aside className="h-fit space-y-4 2xl:sticky 2xl:top-6">
          <CompletionCard
            completion={
              completion
            }
          />

          <ProfileUsageCard />

          <ProfilePrivacyCard />
        </aside>
      </div>

      {dirty && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-700 bg-[#151515]/95 px-4 py-3 shadow-2xl backdrop-blur md:left-64">
          <div className="mx-auto flex w-full max-w-[1900px] flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <p className="text-sm font-medium text-zinc-200">
                Unsaved profile changes
              </p>

              <p className="mt-1 text-xs text-zinc-600">
                Save before leaving to update matching and application content.
              </p>
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={
                  resetChanges
                }
                className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-4 py-2.5 text-sm text-zinc-300 transition hover:bg-zinc-800"
              >
                <RotateCcw
                  size={15}
                />
                Discard changes
              </button>

              <button
                type="submit"
                disabled={
                  hasErrors
                }
                className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
              >
                <Save
                  size={15}
                />
                Save profile
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  )
}

function ProfileOverviewCard({
  form,
  completion,
  roleCount,
  locationCount,
  skillCount,
  minimumSalary,
}) {
  const name =
    form.preferredName ||
    form.fullName ||
    "Your Profile"

  const metrics = [
    {
      label:
        "Target Jobs",
      value:
        roleCount,
    },
    {
      label:
        "Locations",
      value:
        locationCount,
    },
    {
      label:
        "Skills",
      value:
        skillCount,
    },
    {
      label:
        "Minimum Salary",
      value:
        formatSalary(
          minimumSalary,
        ),
    },
  ]

  return (
    <article className="rounded-xl border border-zinc-800 bg-[#151515] p-5 sm:p-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_220px] xl:grid-cols-[minmax(0,1fr)_220px_minmax(360px,0.85fr)] xl:items-center">
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-violet-500/20 bg-violet-500/10 text-lg font-bold text-violet-200">
            {
              getInitials(
                form,
              )
            }
          </div>

          <div className="min-w-0">
            <h2 className="truncate text-xl font-semibold">
              {name}
            </h2>

            <p className="mt-1 truncate text-sm text-zinc-500">
              {form.currentJobTitle ||
                "Current or Recent Role Not Added"}
            </p>

            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-zinc-600">
              {form.location && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin
                    size={13}
                  />
                  {
                    form.location
                  }
                </span>
              )}

              {form.email && (
                <span className="inline-flex items-center gap-1.5">
                  <Mail
                    size={13}
                  />
                  {
                    form.email
                  }
                </span>
              )}

              {form.phone && (
                <span className="inline-flex items-center gap-1.5">
                  <Phone
                    size={13}
                  />
                  {
                    form.phone
                  }
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-950/30 p-4">
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="font-medium text-zinc-400">
              Profile Completion
            </span>

            <span className="font-semibold text-zinc-200">
              {
                completion.percentage
              }%
            </span>
          </div>

          <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full rounded-full bg-violet-400 transition-all"
              style={{
                width: `${completion.percentage}%`,
              }}
            />
          </div>

          <p className="mt-3 text-xs leading-5 text-zinc-600">
            {completion.completed} of {completion.total} useful areas completed
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:col-span-2 xl:col-span-1">
          {metrics.map(
            (metric) => (
              <div
                key={
                  metric.label
                }
                className="min-w-0 rounded-xl border border-zinc-800 bg-zinc-950/30 px-4 py-3"
              >
                <p
                  className="truncate text-base font-semibold text-zinc-200"
                  title={
                    String(
                      metric.value,
                    )
                  }
                >
                  {
                    metric.value
                  }
                </p>

                <p className="mt-1 text-xs text-zinc-600">
                  {
                    metric.label
                  }
                </p>
              </div>
            ),
          )}
        </div>
      </div>
    </article>
  )
}

function ProfileSection({
  icon:
    Icon,
  title,
  description,
  defaultOpen = false,
  children,
}) {
  const [open, setOpen] =
    useState(defaultOpen)

  const sectionId =
    useId()

  return (
    <section className="overflow-hidden rounded-xl border border-zinc-800 bg-[#151515]">
      <button
        type="button"
        onClick={() =>
          setOpen((current) => !current)
        }
        aria-expanded={open}
        aria-controls={sectionId}
        className="group flex w-full items-start gap-3 p-5 text-left transition hover:bg-zinc-900/45 sm:p-6"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-800 text-zinc-300">
          <Icon
            size={18}
          />
        </div>

        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">
            {title}
          </h2>

          <p className="mt-1 text-sm leading-6 text-zinc-500">
            {
              description
            }
          </p>
        </div>

        <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-zinc-700 text-zinc-400 transition group-hover:text-white">
          <ChevronDown
            size={17}
            className={[
              "transition-transform",
              open ? "rotate-180" : "",
            ].join(" ")}
            aria-hidden="true"
          />
        </span>
      </button>

      {open && (
        <div
          id={sectionId}
          role="region"
          aria-label={`${title} fields`}
          className="border-t border-zinc-800 p-5 sm:p-6"
        >
          {children}
        </div>
      )}
    </section>
  )
}

function Field({
  label,
  help,
  error,
  children,
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-zinc-300">
        {label}
      </span>

      {help && (
        <span className="mt-1 block text-xs leading-5 text-zinc-600">
          {help}
        </span>
      )}

      <div className="mt-2">
        {children}
      </div>

      {error && (
        <span className="mt-2 block text-xs text-red-300">
          {error}
        </span>
      )}
    </label>
  )
}

function ListField({
  label,
  help,
  value,
  onChange,
  placeholder,
  rows = 6,
}) {
  const values =
    splitValues(
      value,
    )

  return (
    <Field
      label={label}
      help={help}
    >
      <textarea
        rows={rows}
        value={value}
        onChange={(event) =>
          onChange(
            event.target.value,
          )
        }
        placeholder={
          placeholder
        }
        className={`${inputClass} h-auto resize-y py-3 leading-6`}
      />

      {values.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {values
            .slice(
              0,
              12,
            )
            .map(
              (item) => (
                <span
                  key={
                    item
                  }
                  className="rounded-full border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-xs text-zinc-400"
                >
                  {item}
                </span>
              ),
            )}

          {values.length >
            12 && (
            <span className="rounded-full border border-zinc-800 px-2.5 py-1 text-xs text-zinc-600">
              +{values.length - 12} more
            </span>
          )}
        </div>
      )}
    </Field>
  )
}

function LongTextField({
  label,
  help,
  value,
  onChange,
  placeholder,
  minimum,
  rows = 7,
}) {
  const length =
    value.trim().length

  return (
    <Field
      label={label}
      help={help}
    >
      <textarea
        rows={rows}
        value={value}
        onChange={(event) =>
          onChange(
            event.target.value,
          )
        }
        placeholder={
          placeholder
        }
        className={`${inputClass} h-auto resize-y py-3 leading-6`}
      />

      <div className="mt-2 flex items-center justify-between gap-3 text-xs">
        <span
          className={
            length >=
              minimum
              ? "text-emerald-400"
              : "text-zinc-600"
          }
        >
          {length >=
          minimum
            ? "Useful detail added"
            : `Aim for at least ${minimum} characters`}
        </span>

        <span className="text-zinc-600">
          {length} characters
        </span>
      </div>
    </Field>
  )
}

function OptionGroup({
  label,
  options,
  selected,
  onToggle,
}) {
  return (
    <div className="min-w-0">
      <p className="text-sm font-medium text-zinc-300">
        {label}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {options.map(
          (option) => {
            const active =
              selected.includes(
                option,
              )

            return (
              <button
                key={
                  option
                }
                type="button"
                onClick={() =>
                  onToggle(
                    option,
                  )
                }
                className={[
                  "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition",

                  active
                    ? "border-violet-500/30 bg-violet-500/10 text-violet-200"
                    : "border-zinc-700 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300",
                ].join(
                  " ",
                )}
              >
                {active && (
                  <Check
                    size={14}
                  />
                )}

                {option}
              </button>
            )
          },
        )}
      </div>
    </div>
  )
}

function CompletionCard({
  completion,
}) {
  const missing =
    completion.checks
      .filter(
        (check) =>
          !check.complete,
      )
      .slice(
        0,
        5,
      )

  return (
    <section className="rounded-xl border border-zinc-800 bg-[#151515] p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-violet-500/20 bg-violet-500/10 text-violet-300">
          <Gauge
            size={18}
          />
        </div>

        <div>
          <h2 className="font-semibold">
            Profile Completion
          </h2>

          <p className="mt-1 text-xs leading-5 text-zinc-600">
            Complete the details that improve matching and application writing.
          </p>
        </div>
      </div>

      <div className="mt-5 flex items-end justify-between gap-4">
        <span className="text-3xl font-bold">
          {
            completion.percentage
          }%
        </span>

        <span className="text-xs text-zinc-600">
          {completion.completed}/{completion.total} complete
        </span>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-800">
        <div
          className="h-full rounded-full bg-violet-400"
          style={{
            width: `${completion.percentage}%`,
          }}
        />
      </div>

      {missing.length > 0 ? (
        <div className="mt-5 border-t border-zinc-800 pt-4">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-600">
            Suggested Next Details
          </p>

          <div className="mt-3 space-y-2">
            {missing.map(
              (item) => (
                <div
                  key={
                    item.label
                  }
                  className="flex items-center gap-2 text-xs text-zinc-500"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-zinc-700" />

                  {
                    item.label
                  }
                </div>
              ),
            )}
          </div>
        </div>
      ) : (
        <div className="mt-5 flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs leading-5 text-emerald-200">
          <CheckCircle2
            size={15}
            className="mt-0.5 shrink-0"
          />

          Your profile contains all of the main information BreakVeil uses.
        </div>
      )}
    </section>
  )
}

function ProfileUsageCard() {
  const uses = [
    {
      icon:
        SearchCheck,
      title:
        "Job discovery",
      description:
        "Target roles, locations, salary and workplace preferences.",
    },
    {
      icon:
        WalletCards,
      title:
        "Match scoring",
      description:
        "Skills, recent experience, professional profile and strengths.",
    },
    {
      icon:
        FileText,
      title:
        "Application writing",
      description:
        "Contact details, professional profile, availability and motivation.",
    },
  ]

  return (
    <section className="rounded-xl border border-zinc-800 bg-[#151515] p-5">
      <h2 className="font-semibold">
        Where This Profile Is Used
      </h2>

      <div className="mt-4 space-y-4">
        {uses.map(
          (item) => {
            const Icon =
              item.icon

            return (
              <div
                key={
                  item.title
                }
                className="flex items-start gap-3"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-800 text-zinc-400">
                  <Icon
                    size={15}
                  />
                </div>

                <div>
                  <p className="text-sm font-medium text-zinc-300">
                    {
                      item.title
                    }
                  </p>

                  <p className="mt-1 text-xs leading-5 text-zinc-600">
                    {
                      item.description
                    }
                  </p>
                </div>
              </div>
            )
          },
        )}
      </div>
    </section>
  )
}

function ProfilePrivacyCard() {
  return (
    <section className="rounded-xl border border-zinc-800 bg-[#151515] p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-300">
          <ShieldCheck
            size={16}
          />
        </div>

        <div>
          <h2 className="text-sm font-semibold">
            Stored locally
          </h2>

          <p className="mt-1 text-xs leading-5 text-zinc-600">
            Your Candidate Profile is stored in BreakVeil on this computer. Only include information you are comfortable using in job applications.
          </p>
        </div>
      </div>
    </section>
  )
}

function fieldClass(
  error,
) {
  return [
    inputClass,

    error
      ? "border-red-500/50 focus:border-red-400"
      : "",
  ].join(
    " ",
  )
}

const inputClass =
  "h-11 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-zinc-500"
