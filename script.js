// script.js (drop-in replacement)

// ---------- Globals & tab nav ----------
let leaderboardChart;
let teamLineChart;

const tabButtons = document.querySelectorAll(".tab-button");
const tabContents = document.querySelectorAll(".tab-content");

tabButtons.forEach(button => {
  button.addEventListener("click", () => {
    tabButtons.forEach(btn => btn.classList.remove("active"));
    tabContents.forEach(content => content.classList.remove("active"));
    button.classList.add("active");
    const tabId = button.getAttribute("data-tab");
    const el = document.getElementById(tabId);
    if (el) el.classList.add("active");
  });
});

// ---------- CSV URLs ----------
const sheetAveragesUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTmCvdhmIOdKJpoiyalGvstPDl3EVhm3smT-EzLjlGoXBJArRuDDW1nfoX7tEoMaRd6CJGjvFJ83NtY/pub?gid=1599823711&single=true&output=csv";
const sheetMatchUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTmCvdhmIOdKJpoiyalGvstPDl3EVhm3smT-EzLjlGoXBJArRuDDW1nfoX7tEoMaRd6CJGjvFJ83NtY/pub?gid=1769412869&single=true&output=csv";

// ---------- DOM references ----------
const teamSelect = document.getElementById("team-select");
const teamTable = document.getElementById("team-table")?.querySelector("tbody");
const metricSelect = document.getElementById("metric-select");
const leaderboardSelect = document.getElementById("category-select");
const leaderboardTable = document.getElementById("leaderboard-body");

// Strategy DOM
const strategyMatchSelect = document.getElementById("strategy-match");
const strategySideSelect = document.getElementById("strategy-side");
const strategyBody = document.getElementById("strategy-body"); // entire top tbody that we will overwrite

// ---------- CSV parsing ----------
function parseCSV(text){
  // small CSV parser tuned for your simple exported CSVs (no quoted commas handling)
  const rows = text.trim().split("\n").map(r => r.split(","));
  const headers = rows[0].map(h => h.trim());
  return rows.slice(1).map(r => {
    const obj = {};
    headers.forEach((h, i) => {
      let value = r[i] !== undefined ? r[i].trim() : "";
      if (value === "") obj[h] = "#N/A";
      else if (value === "#N/A") obj[h] = "#N/A";
      else {
        const n = Number(value);
        obj[h] = !isNaN(n) ? Math.round(n) : value;
      }
    });
    return obj;
  });
}

// ---------- Data containers ----------
let sheetData = []; // averages CSV objects
let matchData = []; // match CSV objects

// ---------- Load CSVs ----------
async function fetchSheetData() {
  try {
    const resp = await fetch(sheetAveragesUrl);
    const text = await resp.text();
    sheetData = parseCSV(text);
    console.log("sheetData loaded:", sheetData.length);
  } catch (e) {
    console.error("Error fetching averages CSV:", e);
  }
}

async function loadMatchData() {
  try {
    const resp = await fetch(sheetMatchUrl);
    const text = await resp.text();
    matchData = parseCSV(text);
    console.log("matchData loaded:", matchData.length);
  } catch (e) {
    console.error("Error fetching match CSV:", e);
  }
}

// ---------- Team view helpers ----------
function populateTeamDropdown() {
  if (!Array.isArray(sheetData) || !sheetData.length || !teamSelect) return;
  teamSelect.innerHTML = "";
  const sorted = [...sheetData].sort((a,b) => {
    const A = Number(a.Team), B = Number(b.Team);
    if (!isNaN(A) && !isNaN(B)) return A - B;
    return String(a.Team).localeCompare(String(b.Team));
  });
  sorted.forEach(team => {
    const opt = document.createElement("option");
    opt.value = team.Team;
    opt.textContent = team.Team;
    teamSelect.appendChild(opt);
  });
}

function updateTeamTable(teamNumber) {
  if (!teamTable) return;
  const row = sheetData.find(t => String(t.Team) === String(teamNumber));
  if (!row) {
    teamTable.innerHTML = "<tr><td colspan='2'>No data</td></tr>";
    return;
  }
  teamTable.innerHTML = "";
  for (const key in row) {
    if (key === "Team") continue;
    const tr = document.createElement("tr");
    const value = row[key] === "#N/A" ? "#N/A" : (typeof row[key] === "number" ? String(row[key]) : row[key]);
    tr.innerHTML = `<td>${key}</td><td>${value}</td>`;
    teamTable.appendChild(tr);
  }
}

// ---------- Match-by-match display ----------
function displayTeamMatches(teamNumber) {
  const table = document.getElementById("matchTable");
  if (!table) return;
  const thead = table.querySelector("thead");
  const tbody = table.querySelector("tbody");
  thead.innerHTML = "";
  tbody.innerHTML = "";

  const rows = matchData.filter(r => String(r.Team) === String(teamNumber));
  if (!rows.length) {
    tbody.innerHTML = "<tr><td>No match data found.</td></tr>";
    return;
  }

  // header (skip Team and Notes)
  const headers = Object.keys(rows[0]).filter(h => h !== "Team" && h !== "Notes");
  const headerRow = document.createElement("tr");
  headers.forEach(h => {
    const th = document.createElement("th");
    th.textContent = h;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);

  rows.forEach(row => {
    const tr = document.createElement("tr");
    headers.forEach(h => {
      let v = row[h];
      if (v === "" || v === undefined || v === null || v === "#N/A") v = "#N/A";
      const td = document.createElement("td");
      td.textContent = v;
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
}

// ---------- Metric dropdown for team line chart ----------
function populateMetricDropdown() {
  if (!matchData.length || !metricSelect) return;
  const headers = Object.keys(matchData[0]).filter(h =>
    !["Team","Notes","Match","Alliance","Endgame","Accuracy"].includes(h)
  );
  metricSelect.innerHTML = "";
  headers.forEach(h => {
    const opt = document.createElement("option");
    opt.value = h;
    opt.textContent = h;
    metricSelect.appendChild(opt);
  });
}

function updateTeamLineChart(teamNumber, metric) {
  if (!matchData.length) return;
  const rows = matchData.filter(r => String(r.Team) === String(teamNumber));
  if (!rows.length) return;

  const labels = rows.map(r => r["Match"] || r["match"] || r["#"] || "");
  const values = rows.map(r => {
    const v = r[metric];
    if (v === "#N/A" || v === "" || v === undefined) return null;
    const n = Number(v);
    return isNaN(n) ? null : n;
  });

  const ctx = document.getElementById("teamLineChart")?.getContext?.("2d");
  if (!ctx) return;
  if (teamLineChart) teamLineChart.destroy();
  teamLineChart = new Chart(ctx, {
    type: "line",
    data: { labels, datasets: [{ label: metric, data: values, tension: 0.2, borderWidth: 2, pointRadius: 4 }] },
    options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
  });
}

// ---------- Strategy tab helpers ----------

// get unique matches from matchData (preserve order)
function getUniqueMatches() {
  const seen = new Set();
  const out = [];
  matchData.forEach(r => {
    const m = r["Match"] ?? r["match"] ?? r["Match #"] ?? r["#"] ?? "";
    if (m !== "" && !seen.has(m)) { seen.add(m); out.push(m); }
  });
  return out;
}

function populateStrategyMatchDropdown() {
  if (!strategyMatchSelect) return;
  strategyMatchSelect.innerHTML = "";
  const matches = getUniqueMatches();
  matches.forEach(m => {
    const opt = document.createElement("option");
    opt.value = m;
    opt.textContent = m;
    strategyMatchSelect.appendChild(opt);
  });
  if (matches.length) strategyMatchSelect.value = matches[0];
}

// main rendering routine for strategy table
function updateStrategyTable() {
  if (!strategyBody) return;
  if (!matchData.length || !sheetData.length) {
    // clear and show placeholders
    strategyBody.innerHTML = `
      <tr><th colspan="3" style="background:#ffdddd;">Red</th><th colspan="3" style="background:#ddddff;">Blue</th></tr>
      <tr id="strategy-teams-row">${Array.from({length:6}).map(()=>"<td>—</td>").join("")}</tr>
      <tr><td colspan="3">Total Points</td><td colspan="3">Total Points</td></tr>
      <tr id="strategy-avg-row">${Array.from({length:6}).map(()=>"<td>#N/A</td>").join("")}</tr>
      <tr><td colspan="3">Alliance Total</td><td colspan="3">Alliance Total</td></tr>
      <tr><td colspan="3" id="strategy-red-sum">#N/A</td><td colspan="3" id="strategy-blue-sum">#N/A</td></tr>
    `;
    return;
  }

  const matchValue = strategyMatchSelect?.value;
  const selectedSide = strategySideSelect?.value || "Red";

  // find all rows in matchData matching this match
  const rowsForMatch = matchData.filter(r => String(r["Match"]) === String(matchValue) || String(r["match"]) === String(matchValue));
  // split by alliance
  const redRows = rowsForMatch.filter(r => (r["Alliance"] || "").toString().toLowerCase() === "red");
  const blueRows = rowsForMatch.filter(r => (r["Alliance"] || "").toString().toLowerCase() === "blue");

  // ensure each side length up to 3
  while (redRows.length < 3) redRows.push(null);
  while (blueRows.length < 3) blueRows.push(null);

  // TOP: always show both alliances (6 cells)
  let html = "";
  html += `<tr><th colspan="3" style="background:#ffdddd;">Red</th><th colspan="3" style="background:#ddddff;">Blue</th></tr>`;

  // Teams row
  html += "<tr>";
  [...redRows, ...blueRows].forEach(r => {
    html += `<td>${r && r.Team ? r.Team : "—"}</td>`;
  });
  html += "</tr>";

  // Total Points label row
  html += "<tr><td colspan='3'>Total Points</td><td colspan='3'>Total Points</td></tr>";

  // Averages row (Total Points)
  html += "<tr>";
  [...redRows, ...blueRows].forEach(r => {
    const teamNum = r && r.Team ? String(r.Team) : null;
    const found = sheetData.find(s => String(s.Team) === String(teamNum));
    const v = found && found["Total Points"] !== undefined ? found["Total Points"] : "#N/A";
    html += `<td>${v === "#N/A" ? "#N/A" : (typeof v === "number" ? v : v)}</td>`;
  });
  html += "</tr>";

  // Alliance totals
  const sumOf = arr => arr.reduce((acc, r) => {
    if (!r || !r.Team) return acc;
    const found = sheetData.find(s => String(s.Team) === String(r.Team));
    const v = found && found["Total Points"] !== undefined && found["Total Points"] !== "#N/A" ? Number(found["Total Points"]) : 0;
    return acc + (isNaN(v) ? 0 : v);
  }, 0);

  html += `<tr><td colspan="3" style="font-weight:bold;">${sumOf(redRows)}</td><td colspan="3" style="font-weight:bold;">${sumOf(blueRows)}</td></tr>`;

  // Insert top block
  // Next, add bottom block header and table for metrics (only selected alliance)
  html += `<tr><td colspan="6" style="height:8px;"></td></tr>`; // small spacer

  // We'll create metric rows: first cell is metric name, then exactly 3 cells for the selected alliance
  const metrics = [
    "Total Coral", "L4", "L3", "L2", "L1",
    "Net", "Processor", "Deep Climb", "Shallow Climb"
  ];

  // bottom header (metric label + 3 slots)
  html += `<tr><th>Metric</th><th colspan="3">${selectedSide} teams</th></tr>`;

  // Which side to display in bottom block
  const selectedRows = selectedSide.toLowerCase() === "red" ? redRows : blueRows;

  metrics.forEach(metric => {
    html += `<tr>`;
    html += `<td style="font-weight:bold;">${metric}</td>`;
    // 3 slots for alliance
    for (let i = 0; i < 3; i++) {
      const row = selectedRows[i];
      if (row && row.Team) {
        // find in sheetData the average for this metric
        const found = sheetData.find(s => String(s.Team) === String(row.Team));
        const val = found && found[metric] !== undefined ? found[metric] : "#N/A";
        html += `<td>${val === "#N/A" ? "#N/A" : (typeof val === "number" ? val : val)}</td>`;
      } else {
        html += `<td></td>`; // empty cell for missing slot
      }
    }
    html += `</tr>`;
  });

  // Put final HTML into strategy-body
  strategyBody.innerHTML = html;
}

// ---------- Leaderboard (unchanged core logic) ----------
function updateLeaderboard(category) {
  if (!sheetData.length) return;
  if (!leaderboardTable) return;
  const sorted = [...sheetData].filter(r => !isNaN(r[category])).sort((a,b) => b[category] - a[category]);
  leaderboardTable.innerHTML = "";
  sorted.forEach((team, index) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${index+1}</td><td>${team["Team"]}</td><td colspan="2">${Number(team[category])}</td>`;
    leaderboardTable.appendChild(tr);
  });

  // chart (simple)
  const ctx = document.getElementById("leaderboardChart")?.getContext?.("2d");
  if (!ctx) return;
  const labels = sorted.map(s => s.Team);
  const data = sorted.map(s => Number(s[category]) || 0);
  if (leaderboardChart) leaderboardChart.destroy();
  leaderboardChart = new Chart(ctx, {
    type: "bar",
    data: { labels, datasets: [{ label: `${category} (Average)`, data, borderWidth: 1 }] },
    options: { responsive: true, maintainAspectRatio: false }
  });
}

// ---------- Initialization ----------
async function initAll() {
  await fetchSheetData();
  await loadMatchData();

  // team dropdown
  populateTeamDropdown();
  if (teamSelect) {
    teamSelect.addEventListener("change", () => {
      updateTeamTable(teamSelect.value);
      displayTeamMatches(teamSelect.value);
      updateTeamLineChart(teamSelect.value, metricSelect.value);
    });
    if (teamSelect.options.length) {
      teamSelect.value = teamSelect.options[0].value;
      updateTeamTable(teamSelect.value);
    }
  }

  // metrics
  populateMetricDropdown();
  if (metricSelect) metricSelect.addEventListener("change", () => {
    updateTeamLineChart(teamSelect.value, metricSelect.value);
  });

  // leaderboard
  if (leaderboardSelect) {
    leaderboardSelect.addEventListener("change", e => updateLeaderboard(e.target.value));
    updateLeaderboard(leaderboardSelect.value);
  }

  // strategy dropdown + listeners
  populateStrategyMatchDropdown();
  if (strategyMatchSelect) strategyMatchSelect.addEventListener("change", updateStrategyTable);
  if (strategySideSelect) strategySideSelect.addEventListener("change", updateStrategyTable);

  // initial populate strategy table
  updateStrategyTable();

  // ensure match-by-match and chart for initially selected team
  if (teamSelect && teamSelect.value) {
    displayTeamMatches(teamSelect.value);
    updateTeamLineChart(teamSelect.value, metricSelect.value);
  }
}

// run
initAll();
