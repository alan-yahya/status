const CATALOG = window.LEXIFINA_STATUS_CATALOG || [];
const COMPONENTS = CATALOG.flatMap((group) => group.components);
const COMPONENT_BY_SLUG = new Map(COMPONENTS.map((component) => [component.slug, component]));
const COMPONENT_LABELS = new Set(COMPONENTS.map((component) => component.slug));
const RETIRED_COMPONENT_LABELS = new Set([
  "platform-api",
  "data-services",
  "realtime-services",
]);

// Status data is read straight from the public lexifina/status repository:
// Upptime's summary from raw.githubusercontent.com, incidents from the GitHub API.
const REPOSITORY = "lexifina/status";
const SUMMARY_URL = `https://raw.githubusercontent.com/${REPOSITORY}/HEAD/history/summary.json`;
const ISSUES_URL = `https://api.github.com/repos/${REPOSITORY}/issues`;

async function fetchJson(url, accept = "application/json") {
  const response = await fetch(url, {
    headers: { Accept: accept },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`Status data returned ${response.status}`);
  return response.json();
}

// Incidents are optional: if the GitHub API is rate-limited, the components still render.
async function fetchIncidents(state, perPage) {
  const params = new URLSearchParams({
    state,
    labels: "status",
    sort: state === "open" ? "created" : "updated",
    direction: "desc",
    per_page: String(perPage),
  });
  try {
    const issues = await fetchJson(`${ISSUES_URL}?${params}`, "application/vnd.github+json");
    return Array.isArray(issues) ? issues : [];
  } catch {
    return [];
  }
}

function labelsFor(issue) {
  return (issue?.labels || []).map((label) =>
    String(typeof label === "string" ? label : label.name || "").toLowerCase(),
  );
}

function statusKind(status) {
  if (status === "up") return "up";
  if (status === "degraded") return "degraded";
  if (status === "maintenance") return "maintenance";
  if (status === "unknown") return "unknown";
  return "down";
}

function statusLabel(status) {
  if (status === "up") return "Operational";
  if (status === "degraded") return "Degraded";
  if (status === "maintenance") return "Maintenance";
  if (status === "unknown") return "Awaiting data";
  return "Unavailable";
}

function statusSymbol(kind) {
  return kind === "up" ? "✓" : kind === "degraded" ? "!" : kind === "maintenance" ? "–" : kind === "unknown" ? "?" : "×";
}

function formatDate(value) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatTooltipDate(value) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function constrainTooltipToViewport(tooltip) {
  tooltip.style.setProperty("--tooltip-shift-x", "0px");
  window.requestAnimationFrame(() => {
    const margin = 8;
    const bounds = tooltip.getBoundingClientRect();
    let shift = 0;
    if (bounds.left < margin) shift = margin - bounds.left;
    if (bounds.right > window.innerWidth - margin) {
      shift = window.innerWidth - margin - bounds.right;
    }
    tooltip.style.setProperty("--tooltip-shift-x", `${Math.round(shift)}px`);
  });
}

function issueAppliesToComponent(issue, component) {
  const issueLabels = labelsFor(issue);
  const scopedLabels = issueLabels.filter((label) => COMPONENT_LABELS.has(label));
  if (scopedLabels.length > 0) return scopedLabels.includes(component.slug);
  // Old component-scoped incidents must not become global incidents merely
  // because their component label was retired from the public catalogue.
  if (issueLabels.some((label) => RETIRED_COMPONENT_LABELS.has(label))) return false;
  return true;
}

function issueState(issue) {
  const labels = labelsFor(issue);
  if (labels.includes("maintenance") || labels.includes("planned-maintenance")) return "maintenance";
  if (labels.includes("degraded") || labels.includes("degraded-performance")) return "degraded";
  return "down";
}

function effectiveStatus(componentData, componentConfig, activeIssues) {
  if (!componentData) return "unknown";
  if (statusKind(componentData.status) === "down") return "down";
  const issueStates = activeIssues
    .filter((issue) => issueAppliesToComponent(issue, componentConfig))
    .map(issueState);
  if (issueStates.includes("down")) return "down";
  if (issueStates.includes("degraded")) return "degraded";
  if (issueStates.includes("maintenance")) return "maintenance";
  return "up";
}

function worstStatus(statuses) {
  if (statuses.includes("down")) return "down";
  if (statuses.includes("degraded")) return "degraded";
  if (statuses.includes("maintenance")) return "maintenance";
  if (statuses.includes("unknown")) return "unknown";
  return "up";
}

function updateOverall(statuses) {
  const card = document.querySelector("#overall-card");
  const title = document.querySelector("#overall-title");
  const copy = document.querySelector("#overall-copy");
  const icon = document.querySelector("#overall-icon");
  const status = worstStatus(statuses);

  card.className = `overall-card is-${status}`;
  icon.textContent = statusSymbol(status);
  if (status === "down") {
    title.textContent = "Some systems are unavailable";
    copy.textContent = "We’re investigating an interruption affecting Lexifina services.";
  } else if (status === "degraded") {
    title.textContent = "Some systems are experiencing issues";
    copy.textContent = "One or more Lexifina capabilities are operating with degraded performance.";
  } else if (status === "maintenance") {
    title.textContent = "Scheduled maintenance is in progress";
    copy.textContent = "Some Lexifina capabilities may be temporarily affected.";
  } else if (status === "unknown") {
    title.textContent = "Some status data is unavailable";
    copy.textContent = "One or more component checks have not reported yet.";
  } else {
    title.textContent = "All systems operational";
    copy.textContent = "We’re not aware of any issues affecting Lexifina.";
  }
}

function incidentForDate(issues, component, dateKey) {
  return issues.find((issue) => {
    if (!issueAppliesToComponent(issue, component)) return false;
    const opened = String(issue.created_at || "").slice(0, 10);
    const resolved = String(issue.closed_at || new Date().toISOString()).slice(0, 10);
    return opened && opened <= dateKey && dateKey <= resolved;
  });
}

function createTooltip(date, kind, detail) {
  const tooltip = createElement("span", "uptime-tooltip");
  tooltip.setAttribute("role", "tooltip");
  tooltip.setAttribute("aria-hidden", "true");
  tooltip.append(createElement("span", "tooltip-date", formatTooltipDate(date)));
  const detailRow = createElement("span", "tooltip-detail");
  const icon = createElement("span", `tooltip-icon is-${kind}`, statusSymbol(kind));
  icon.setAttribute("aria-hidden", "true");
  detailRow.append(icon, createElement("span", "", detail));
  tooltip.append(detailRow);
  return tooltip;
}

function monitoredWindowStart(componentConfig) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const windowStart = new Date(today);
  windowStart.setUTCDate(today.getUTCDate() - 89);
  const monitoringStart = new Date(`${componentConfig.monitoringSince}T00:00:00Z`);
  return monitoringStart > windowStart ? monitoringStart : windowStart;
}

function calculateWindowUptime(componentData, componentConfig) {
  if (!componentData || componentData.liveOnly) return null;
  const now = new Date();
  const start = monitoredWindowStart(componentConfig);
  const monitoredMinutes = Math.max(0, (now.getTime() - start.getTime()) / 60_000);
  if (monitoredMinutes <= 0) return null;
  const minutesDown = Object.entries(componentData.dailyMinutesDown || {}).reduce(
    (total, [date, minutes]) => date >= start.toISOString().slice(0, 10)
      ? total + Math.max(0, Number(minutes) || 0)
      : total,
    0,
  );
  const uptime = Math.max(0, 100 * (1 - Math.min(minutesDown, monitoredMinutes) / monitoredMinutes));
  return `${uptime.toFixed(2)}%`;
}

function createBars(componentData, componentConfig, issues, currentStatus) {
  const bars = createElement("div", "uptime-bars");
  const uptime = calculateWindowUptime(componentData, componentConfig);
  const hasHistory = Boolean(componentData && !componentData.liveOnly);
  bars.setAttribute("role", "group");
  bars.setAttribute(
    "aria-label",
    `${componentConfig.name}: ${uptime || "no uptime data"} over the monitored portion of the last 90 days`,
  );
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  for (let offset = 89; offset >= 0; offset -= 1) {
    const date = new Date(today);
    date.setUTCDate(today.getUTCDate() - offset);
    const key = date.toISOString().slice(0, 10);
    const beforeMonitoring = key < componentConfig.monitoringSince;
    const minutesDown = Number(componentData?.dailyMinutesDown?.[key] || 0);
    const incident = incidentForDate(issues, componentConfig, key);
    let kind = "up";
    let detail = "No incidents";

    if (beforeMonitoring) {
      kind = "unknown";
      detail = "No monitoring data";
    } else if (!hasHistory) {
      kind = "unknown";
      detail = componentData ? "Historical monitoring pending" : "Awaiting first check";
    } else if (minutesDown >= 1_440) {
      kind = "down";
      detail = "Unavailable throughout the day";
    } else if (minutesDown > 0) {
      kind = "degraded";
      detail = `${Math.round(minutesDown)} minutes unavailable`;
    }

    if (incident && !beforeMonitoring) {
      const incidentKind = issueState(incident);
      if (kind === "up" || incidentKind === "down") kind = incidentKind;
      detail = incident.title || statusLabel(kind);
    }
    if (offset === 0 && !beforeMonitoring) {
      kind = currentStatus;
      if (!incident && (currentStatus !== "up" || !hasHistory)) detail = statusLabel(currentStatus);
    }

    const bar = createElement("button", `uptime-bar is-${kind}`);
    bar.type = "button";
    bar.tabIndex = -1;
    bar.setAttribute("aria-label", `${formatTooltipDate(date)}: ${detail}`);
    const tooltip = createTooltip(date, kind, detail);
    bar.append(tooltip);
    bar.addEventListener("pointerenter", () => constrainTooltipToViewport(tooltip));
    bar.addEventListener("focus", () => constrainTooltipToViewport(tooltip));
    bars.append(bar);
  }
  window.requestAnimationFrame(() => {
    const firstVisible = [...bars.children].find((bar) => bar.offsetParent !== null);
    if (firstVisible) firstVisible.tabIndex = 0;
  });
  bars.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    const visibleBars = [...bars.children].filter((bar) => bar.offsetParent !== null);
    if (!visibleBars.length) return;
    const currentIndex = Math.max(0, visibleBars.indexOf(document.activeElement));
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? visibleBars.length - 1
        : Math.max(0, Math.min(
          visibleBars.length - 1,
          currentIndex + (event.key === "ArrowLeft" ? -1 : 1),
        ));
    event.preventDefault();
    visibleBars.forEach((bar, index) => { bar.tabIndex = index === nextIndex ? 0 : -1; });
    visibleBars[nextIndex].focus();
  });
  return bars;
}

function createInfoTip(text, label, focusable = true) {
  const wrapper = createElement("span", "info-tip");
  if (focusable) {
    wrapper.setAttribute("tabindex", "0");
    wrapper.setAttribute("aria-label", `${label}: ${text}`);
  } else {
    wrapper.setAttribute("aria-hidden", "true");
  }
  wrapper.append(createElement("span", "info-symbol"));
  const tooltip = createElement("span", "info-tooltip", text);
  tooltip.setAttribute("role", "tooltip");
  wrapper.append(tooltip);
  wrapper.addEventListener("pointerenter", () => constrainTooltipToViewport(tooltip));
  wrapper.addEventListener("focus", () => constrainTooltipToViewport(tooltip));
  return wrapper;
}

function renderComponents(summary, activeIssues, allIssues) {
  const list = document.querySelector("#component-list");
  const expansionState = new Map(
    [...list.querySelectorAll(".component-group")].map((element) => [
      element.dataset.group,
      element.querySelector(".group-header")?.getAttribute("aria-expanded") !== "false",
    ]),
  );
  const dataBySlug = new Map((summary || []).map((component) => [component.slug, component]));
  const statuses = [];
  list.replaceChildren();

  for (const group of CATALOG) {
    const groupElement = createElement("section", "component-group");
    groupElement.dataset.group = group.id;
    const groupStatuses = group.components.map((component) =>
      effectiveStatus(dataBySlug.get(component.slug), component, activeIssues),
    );
    const groupStatus = worstStatus(groupStatuses);
    statuses.push(...groupStatuses);

    const header = createElement("button", "group-header");
    const expanded = expansionState.get(group.id) ?? false;
    header.type = "button";
    header.setAttribute("aria-expanded", String(expanded));
    const description = createElement("span", "sr-only", group.description);
    description.id = `group-description-${group.id}`;
    const groupName = createElement("span", "group-name", group.name);
    header.setAttribute("aria-describedby", description.id);
    const icon = createElement("span", `component-status is-${groupStatus}`);
    icon.setAttribute("aria-hidden", "true");
    const identity = createElement("span", "group-identity");
    const titleLine = createElement("span", "group-title-line");
    titleLine.append(groupName, createInfoTip(group.description, group.name, false));
    const groupCount = createElement("span", "group-count", `${group.components.length} ${group.components.length === 1 ? "component" : "components"}`);
    identity.append(titleLine, groupCount);
    const chevron = createElement("span", "group-chevron");
    chevron.setAttribute("aria-hidden", "true");
    header.append(icon, identity, chevron);

    const children = createElement("div", "group-components");
    const childrenInner = createElement("div", "group-components-inner");
    children.classList.toggle("is-collapsed", !expanded);
    children.setAttribute("aria-hidden", String(!expanded));
    children.inert = !expanded;
    const populateChildren = () => {
      if (childrenInner.childElementCount) return;
      for (const componentConfig of group.components) {
        const componentData = dataBySlug.get(componentConfig.slug);
        const currentStatus = effectiveStatus(componentData, componentConfig, activeIssues);
        const uptime = calculateWindowUptime(componentData, componentConfig);
        const row = createElement("article", "component-row");
        const topLine = createElement("div", "component-topline");
        const componentIcon = createElement("span", `component-status is-${currentStatus}`);
        componentIcon.setAttribute("aria-hidden", "true");
        const nameWrap = createElement("span", "component-name-wrap");
        nameWrap.append(
          createElement("span", "component-name", componentConfig.name),
          createInfoTip(componentConfig.description, componentConfig.name),
        );
        const metrics = createElement(
          "span",
          "component-metrics",
          uptime
            ? `${uptime} uptime`
            : componentData?.liveOnly
              ? `${statusLabel(currentStatus)} · history pending`
              : "Awaiting data",
        );
        topLine.append(componentIcon, nameWrap, metrics);
        row.append(topLine, createBars(componentData, componentConfig, allIssues, currentStatus));
        childrenInner.append(row);
      }
    };
    if (expanded) populateChildren();
    children.append(childrenInner);

    let transitionTimer;
    header.addEventListener("click", () => {
      const isExpanded = header.getAttribute("aria-expanded") === "true";
      window.clearTimeout(transitionTimer);
      if (!isExpanded) populateChildren();
      children.classList.add("is-animating");
      header.setAttribute("aria-expanded", String(!isExpanded));
      children.classList.toggle("is-collapsed", isExpanded);
      children.setAttribute("aria-hidden", String(isExpanded));
      children.inert = isExpanded;
      transitionTimer = window.setTimeout(() => {
        children.classList.remove("is-animating");
      }, 300);
    });
    groupElement.append(header, description, children);
    list.append(groupElement);
  }

  list.setAttribute("aria-busy", "false");
  updateOverall(statuses);
}

function issueSummary(issue) {
  const body = String(issue.body || "").replace(/<!--[^]*?-->/g, "").trim();
  return body ? body.slice(0, 320) : "We are investigating and will provide updates here.";
}

function consolidateActiveIncidents(issues) {
  const ordered = [...issues].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  const clusters = [];
  for (const issue of ordered) {
    const last = clusters.at(-1);
    const opened = new Date(issue.created_at).getTime();
    if (last && opened - last.openedAt <= 10 * 60 * 1_000) {
      last.issues.push(issue);
    } else {
      clusters.push({ openedAt: opened, issues: [issue] });
    }
  }
  return clusters.map(({ issues: clustered }) => {
    if (clustered.length === 1) return clustered[0];
    const labels = [...new Set(clustered.flatMap(labelsFor))];
    const affected = labels.filter((label) => COMPONENT_LABELS.has(label));
    return {
      title: "Multiple Lexifina services are affected",
      body: `We are investigating an interruption affecting ${affected.length || clustered.length} monitored capabilities.`,
      created_at: clustered[0].created_at,
      labels,
    };
  });
}

function renderActiveIncidents(issues) {
  const card = document.querySelector("#incident-card");
  const container = document.querySelector("#active-incidents");
  if (!issues.length) {
    card.hidden = true;
    container.replaceChildren();
    return;
  }
  card.hidden = false;
  container.replaceChildren();

  for (const issue of consolidateActiveIncidents(issues)) {
    const entry = createElement("article", "incident-entry");
    entry.append(
      createElement("h3", "", issue.title),
      createElement("p", "", issueSummary(issue)),
      createElement("div", "incident-meta", `Investigating · Opened ${formatDate(issue.created_at)}`),
    );
    container.append(entry);
  }
}

function renderUnavailable() {
  renderComponents([], [], []);
  const card = document.querySelector("#overall-card");
  card.className = "overall-card is-down";
  document.querySelector("#overall-icon").textContent = "×";
  document.querySelector("#overall-title").textContent = "Live status is temporarily unavailable";
  document.querySelector("#overall-copy").textContent = "The status data service could not be reached. Please try again shortly.";
}

async function start() {
  try {
    const [historicalComponents, openIncidents, closedIncidents] = await Promise.all([
      fetchJson(SUMMARY_URL),
      fetchIncidents("open", 30),
      fetchIncidents("closed", 50),
    ]);
    const livePayload = { components: [] };
    if (![historicalComponents, livePayload.components, openIncidents, closedIncidents]
      .every(Array.isArray)) {
      throw new Error("Incomplete status data returned");
    }
    const componentMap = new Map(historicalComponents.map((component) => [component.slug, component]));
    for (const liveComponent of livePayload.components || []) {
      const historical = componentMap.get(liveComponent.slug);
      componentMap.set(liveComponent.slug, {
        ...historical,
        ...liveComponent,
        liveOnly: !historical,
      });
    }
    const components = [...componentMap.values()];
    const activeIncidents = openIncidents.filter((issue) => !issue.pull_request);
    const previousIncidents = closedIncidents.filter((issue) => !issue.pull_request);
    renderComponents(components, activeIncidents, [...activeIncidents, ...previousIncidents]);
    renderActiveIncidents(activeIncidents);
  } catch {
    renderUnavailable();
  }
}

start();
