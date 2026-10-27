window.LEXIFINA_STATUS_CATALOG = Object.freeze([
  {
    id: "website",
    name: "Lexifina website",
    description: "Public pages at lexifina.com.",
    components: [
      {
        slug: "website",
        name: "Website",
        monitoringSince: "2026-09-04",
        description: "Availability of lexifina.com and its published Lexifina page.",
      },
    ],
  },
  {
    id: "lexifina-app",
    name: "Lexifina app",
    description: "Customer-facing capabilities in the browser and mobile application.",
    components: [
      {
        slug: "web-application",
        name: "Web app",
        monitoringSince: "2026-09-04",
        description: "Availability of the app shell at app.lexifina.com. Feature-specific checks appear below.",
      },
      {
        slug: "login-accounts",
        name: "Login and accounts",
        monitoringSince: "2026-09-04",
        description: "Authentication signing and verification plus access to the user-account data path.",
      },
      {
        slug: "documents",
        name: "Documents",
        monitoringSince: "2026-09-04",
        description: "Availability of the core document workspace and document-record data path.",
      },
      {
        slug: "file-uploads",
        name: "File uploads",
        monitoringSince: "2026-09-04",
        description: "File-storage and upload-processing queue readiness. Five-minute checks do not create customer files.",
      },
      {
        slug: "document-processing",
        name: "Document processing",
        monitoringSince: "2026-09-04",
        description: "Availability of document records and the durable document-processing job path.",
      },
      {
        slug: "ai-drafting-review",
        name: "AI drafting and review",
        monitoringSince: "2026-09-04",
        description: "Configured AI runtime, conversation storage and live runtime service. The public check does not invoke a paid model.",
      },
      {
        slug: "search-library",
        name: "Search and library",
        monitoringSince: "2026-09-04",
        description: "Availability of Lexifina's workspace search entries and search-index state.",
      },
      {
        slug: "automations",
        name: "Automations",
        monitoringSince: "2026-09-04",
        description: "Availability of automation definitions and their durable execution path.",
      },
      {
        slug: "matters-client-intake",
        name: "Matters and client intake",
        monitoringSince: "2026-09-04",
        description: "Availability of matter workspaces, intake instances and questionnaire templates.",
      },
      {
        slug: "approvals",
        name: "Approvals",
        monitoringSince: "2026-09-04",
        description: "Availability of approval packets and the documents they review.",
      },
      {
        slug: "e-signatures",
        name: "E-signatures",
        monitoringSince: "2026-09-04",
        description: "Availability of signature requests and their associated document path.",
      },
      {
        slug: "live-updates",
        name: "Live updates",
        monitoringSince: "2026-09-04",
        description: "Connectivity between the public backend and Lexifina's realtime event service.",
      },
    ],
  },
  {
    id: "microsoft-integrations",
    name: "Microsoft integrations",
    description: "Lexifina experiences delivered through Microsoft products.",
    components: [
      {
        slug: "word-add-in",
        name: "Word add-in",
        monitoringSince: "2026-09-04",
        description: "Availability of the published Word task pane. Microsoft Word itself is not tested by this check.",
      },
      {
        slug: "outlook-integration",
        name: "Outlook integration",
        monitoringSince: "2026-09-04",
        description: "Lexifina Outlook connector configuration and connection storage. Individual Microsoft accounts are not tested.",
      },
    ],
  },
]);
