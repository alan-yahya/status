const REPOSITORY = "lexifina/status";

function formatDate(value) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

async function start() {
  const list = document.querySelector("#history-list");
  try {
    const url = `https://api.github.com/repos/${REPOSITORY}/issues?state=closed&labels=status&sort=updated&direction=desc&per_page=30`;
    const response = await fetch(url, {
      headers: { Accept: "application/vnd.github+json" },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new Error(`Status API returned ${response.status}`);
    const issues = (await response.json()).filter((issue) => !issue.pull_request);
    list.replaceChildren();
    list.setAttribute("aria-busy", "false");

    if (!issues.length) {
      list.append(element("p", "history-empty", "No recent incidents have been reported."));
      return;
    }

    for (const issue of issues) {
      const item = element("article", "history-item");
      item.append(
        element("h2", "", issue.title),
        element("p", "", `Resolved ${formatDate(issue.closed_at || issue.updated_at)}`),
      );
      list.append(item);
    }
  } catch {
    list.setAttribute("aria-busy", "false");
    list.replaceChildren(element("p", "history-empty", "Incident history is temporarily unavailable."));
  }
}

start();
