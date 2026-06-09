const PERIODS = [
  { key: "morning", label: "오전" },
  { key: "afternoon", label: "오후" },
];

const WORK_TYPES = [
  { key: "joint", label: "합동" },
  { key: "move", label: "이전" },
  { key: "existing", label: "기존" },
];

const STORAGE_KEYS = {
  session: "workcheck:session",
  settings: "workcheck:settings",
  records: "workcheck:records",
};

const defaultSettings = {
  teamCount: 4,
};

let state = {
  client: null,
  connected: false,
  user: null,
  settings: structuredClone(defaultSettings),
  records: [],
  adminRows: [],
};

const elements = {
  loginView: document.querySelector("#loginView"),
  appView: document.querySelector("#appView"),
  adminView: document.querySelector("#adminView"),
  workerView: document.querySelector("#workerView"),
  loginForm: document.querySelector("#loginForm"),
  loginId: document.querySelector("#loginId"),
  loginPassword: document.querySelector("#loginPassword"),
  loginMessage: document.querySelector("#loginMessage"),
  sessionText: document.querySelector("#sessionText"),
  connectionStatus: document.querySelector("#connectionStatus"),
  logoutButton: document.querySelector("#logoutButton"),
  workDate: document.querySelector("#workDate"),
  adminDateFrom: document.querySelector("#adminDateFrom"),
  adminDateTo: document.querySelector("#adminDateTo"),
  teamCount: document.querySelector("#teamCount"),
  saveSettingsButton: document.querySelector("#saveSettingsButton"),
  loadAdminButton: document.querySelector("#loadAdminButton"),
  reloadButton: document.querySelector("#reloadButton"),
  saveRecordsButton: document.querySelector("#saveRecordsButton"),
  downloadButton: document.querySelector("#downloadButton"),
  recordsBody: document.querySelector("#recordsBody"),
  recordsFoot: document.querySelector("#recordsFoot"),
  adminBody: document.querySelector("#adminBody"),
  adminFoot: document.querySelector("#adminFoot"),
  summaryText: document.querySelector("#summaryText"),
  adminRangeText: document.querySelector("#adminRangeText"),
  adminTotalText: document.querySelector("#adminTotalText"),
  adminDateCountText: document.querySelector("#adminDateCountText"),
  quantityCellTemplate: document.querySelector("#quantityCellTemplate"),
};

init();

async function init() {
  const today = new Date().toISOString().slice(0, 10);
  elements.workDate.value = today;
  elements.adminDateFrom.value = today;
  elements.adminDateTo.value = today;
  bindEvents();
  connectSupabase();

  const savedSession = readLocal(STORAGE_KEYS.session, null);
  if (savedSession?.id) {
    await completeLogin(savedSession);
  }
}

function bindEvents() {
  elements.loginForm.addEventListener("submit", login);
  elements.logoutButton.addEventListener("click", logout);
  elements.saveSettingsButton.addEventListener("click", saveSettings);
  elements.loadAdminButton.addEventListener("click", loadAdminRecords);
  elements.reloadButton.addEventListener("click", loadRecords);
  elements.saveRecordsButton.addEventListener("click", saveRecords);
  elements.downloadButton.addEventListener("click", downloadAdminExcel);
  elements.workDate.addEventListener("change", loadRecords);
}

function connectSupabase() {
  const config = window.WORKCHECK_CONFIG || {};
  const url = config.SUPABASE_URL || "";
  const key = config.SUPABASE_PUBLISHABLE_KEY || "";

  if (!url || !key || !window.supabase) {
    setConnection(false);
    elements.loginMessage.textContent = "Supabase 환경설정이 없습니다.";
    return;
  }

  state.client = window.supabase.createClient(url, key);
  setConnection(true);
}

async function login(event) {
  event.preventDefault();
  elements.loginMessage.textContent = "";

  const loginId = elements.loginId.value.trim();
  const password = elements.loginPassword.value;

  if (!state.connected) {
    elements.loginMessage.textContent = "Supabase 연결 후 로그인할 수 있습니다.";
    return;
  }

  const { data, error } = await state.client.rpc("work_login", {
    p_login_id: loginId,
    p_password: password,
  });

  const user = Array.isArray(data) ? data[0] : data;
  if (error || !user) {
    elements.loginMessage.textContent = "아이디 또는 패스워드가 맞지 않습니다.";
    return;
  }

  const sessionUser = {
    id: user.user_id,
    loginId: user.login_id,
    displayName: user.display_name || user.login_id,
    role: user.role || "worker",
    teamNo: user.team_no ? Number(user.team_no) : null,
  };

  localStorage.setItem(STORAGE_KEYS.session, JSON.stringify(sessionUser));
  await completeLogin(sessionUser);
}

async function completeLogin(user) {
  state.user = normalizeUserRole(user);
  await loadSettings();

  elements.loginView.hidden = true;
  elements.appView.hidden = false;
  elements.adminView.hidden = state.user.role !== "admin";
  elements.workerView.hidden = state.user.role !== "worker";
  elements.sessionText.textContent = `${state.user.displayName || state.user.loginId} · ${
    state.user.role === "admin" ? "관리자" : `${state.user.teamNo || "-"}조 작업자`
  }`;
  renderSettings();

  if (state.user.role === "admin") {
    await loadAdminRecords();
  } else {
    await loadRecords();
  }
}

function normalizeUserRole(user) {
  return {
    ...user,
    role: user.role === "admin" ? "admin" : "worker",
  };
}

function logout() {
  localStorage.removeItem(STORAGE_KEYS.session);
  state.user = null;
  state.records = [];
  state.adminRows = [];
  elements.loginPassword.value = "";
  elements.appView.hidden = true;
  elements.loginView.hidden = false;
}

function setConnection(connected) {
  state.connected = connected;
  elements.connectionStatus.textContent = connected ? "Supabase 연결" : "연결 필요";
  elements.connectionStatus.classList.toggle("connected", connected);
}

async function loadSettings() {
  if (state.connected) {
    const { data, error } = await state.client.from("work_settings").select("value").eq("id", "default").maybeSingle();
    if (!error && data?.value) {
      state.settings = normalizeSettings(data.value);
      localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(state.settings));
      return;
    }
  }

  state.settings = normalizeSettings(readLocal(STORAGE_KEYS.settings, defaultSettings));
}

function renderSettings() {
  elements.teamCount.value = state.settings.teamCount;
}

async function saveSettings() {
  if (state.user?.role !== "admin") return;

  state.settings = normalizeSettings({ teamCount: Number(elements.teamCount.value) });
  localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(state.settings));

  const { error } = await state.client.from("work_settings").upsert({
    id: "default",
    value: state.settings,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    alert(`조 수량 저장 실패: ${error.message}`);
    return;
  }

  alert("조 수량을 저장했습니다.");
  await loadAdminRecords();
}

async function loadRecords() {
  if (!state.user || state.user.role !== "worker") return;

  const { data, error } = await state.client
    .from("work_records")
    .select("*")
    .eq("work_date", elements.workDate.value)
    .order("team_no")
    .order("period")
    .order("work_type");

  if (error) {
    alert(`조회 실패: ${error.message}`);
    return;
  }

  state.records = mergeRecordsWithGrid((data || []).map(fromDbRecord));
  renderRecords();
}

async function saveRecords() {
  if (!state.user || state.user.role !== "worker") return;

  syncInputsToState();
  const payload = state.records.map(toDbRecord);
  const { error } = await state.client.from("work_records").upsert(payload, {
    onConflict: "work_date,team_no,period,work_type",
  });

  if (error) {
    alert(`저장 실패: ${error.message}`);
    return;
  }

  renderRecords();
  alert("수량을 저장했습니다.");
}

async function loadAdminRecords() {
  if (!state.user || state.user.role !== "admin") return;

  const from = elements.adminDateFrom.value;
  const to = elements.adminDateTo.value;
  const { data, error } = await state.client
    .from("work_records")
    .select("work_date, team_no, period, work_type, actual_qty, updated_at")
    .gte("work_date", from)
    .lte("work_date", to)
    .order("work_date")
    .order("team_no")
    .order("period")
    .order("work_type");

  if (error) {
    alert(`전체 조회 실패: ${error.message}`);
    return;
  }

  state.adminRows = buildAdminRows((data || []).map(fromDbRecord));
  renderAdminRecords();
}

function createBlankRecords() {
  const records = [];
  const teamNumbers = state.user?.role === "worker" ? [Number(state.user.teamNo || 1)] : getAllTeamNumbers();

  for (const teamNo of teamNumbers) {
    for (const period of PERIODS) {
      for (const type of WORK_TYPES) {
        records.push({
          workDate: elements.workDate.value,
          teamNo,
          period: period.key,
          workType: type.key,
          actualQty: 0,
        });
      }
    }
  }

  return records;
}

function mergeRecordsWithGrid(records) {
  const byKey = new Map(records.map((record) => [recordKey(record), record]));
  return createBlankRecords().map((base) => {
    const saved = byKey.get(recordKey(base));
    return saved ? { ...base, actualQty: Number(saved.actualQty || 0) } : base;
  });
}

function buildAdminRows(records) {
  const grouped = new Map();

  for (const record of records) {
    const key = `${record.workDate}:${record.teamNo}`;
    if (!grouped.has(key)) {
      grouped.set(key, {
        workDate: record.workDate,
        teamNo: record.teamNo,
        values: {
          morning: { joint: 0, move: 0, existing: 0 },
          afternoon: { joint: 0, move: 0, existing: 0 },
        },
      });
    }
    grouped.get(key).values[record.period][record.workType] = Number(record.actualQty || 0);
  }

  return [...grouped.values()].sort((a, b) => `${a.workDate}:${a.teamNo}`.localeCompare(`${b.workDate}:${b.teamNo}`));
}

function getAllTeamNumbers() {
  return Array.from({ length: state.settings.teamCount }, (_, index) => index + 1);
}

function renderRecords() {
  elements.recordsBody.innerHTML = "";
  elements.recordsFoot.innerHTML = "";
  const teamNumbers = state.user?.role === "worker" ? [Number(state.user.teamNo || 1)] : getAllTeamNumbers();

  for (const teamNo of teamNumbers) {
    const row = document.createElement("tr");
    const teamHeader = document.createElement("th");
    teamHeader.textContent = `${teamNo}조`;
    row.append(teamHeader);

    for (const period of PERIODS) {
      for (const type of WORK_TYPES) {
        row.append(createQuantityCell(teamNo, period.key, type.key));
      }
    }

    row.append(createTextCell(getTeamTotal(teamNo)));
    elements.recordsBody.append(row);
  }

  renderFoot();
  renderSummary();
}

function renderAdminRecords() {
  elements.adminBody.innerHTML = "";
  elements.adminFoot.innerHTML = "";

  for (const item of state.adminRows) {
    const row = document.createElement("tr");
    row.append(createTextCell(item.workDate), createTextCell(`${item.teamNo}조`));
    for (const period of PERIODS) {
      for (const type of WORK_TYPES) {
        row.append(createTextCell(item.values[period.key][type.key]));
      }
    }
    row.append(createTextCell(getAdminRowTotal(item)));
    elements.adminBody.append(row);
  }

  const foot = document.createElement("tr");
  foot.append(createTextCell("합계", "th"), createTextCell(""));
  for (const period of PERIODS) {
    for (const type of WORK_TYPES) {
      foot.append(createTextCell(getAdminTypeTotal(period.key, type.key)));
    }
  }
  foot.append(createTextCell(getAdminGrandTotal()));
  elements.adminFoot.append(foot);

  const dateCount = new Set(state.adminRows.map((row) => row.workDate)).size;
  elements.adminRangeText.textContent = `${elements.adminDateFrom.value} ~ ${elements.adminDateTo.value}`;
  elements.adminTotalText.textContent = `${getAdminGrandTotal().toLocaleString()}개`;
  elements.adminDateCountText.textContent = `${dateCount.toLocaleString()}일`;
}

function createQuantityCell(teamNo, period, workType) {
  const record = findRecord(teamNo, period, workType);
  const td = document.createElement("td");
  const cell = elements.quantityCellTemplate.content.firstElementChild.cloneNode(true);
  const input = cell.querySelector("input");
  input.value = record.actualQty;
  input.dataset.teamNo = teamNo;
  input.dataset.period = period;
  input.dataset.workType = workType;
  input.addEventListener("input", () => {
    syncInputsToState();
    renderFoot();
    renderSummary();
  });
  td.append(cell);
  return td;
}

function renderFoot() {
  syncInputsToState();
  const row = document.createElement("tr");
  row.append(createTextCell("합계", "th"));

  for (const period of PERIODS) {
    for (const type of WORK_TYPES) {
      const total = state.records
        .filter((record) => record.period === period.key && record.workType === type.key)
        .reduce((sum, record) => sum + Number(record.actualQty || 0), 0);
      row.append(createTextCell(total));
    }
  }

  row.append(createTextCell(getGrandTotal()));
  elements.recordsFoot.replaceChildren(row);
}

function renderSummary() {
  elements.summaryText.textContent = `${elements.workDate.value} 입력 ${getGrandTotal().toLocaleString()}개`;
}

function syncInputsToState() {
  document.querySelectorAll(".quantity-cell input").forEach((input) => {
    const record = findRecord(Number(input.dataset.teamNo), input.dataset.period, input.dataset.workType);
    if (record) record.actualQty = Number(input.value || 0);
  });
}

function createTextCell(text, tagName = "td") {
  const cell = document.createElement(tagName);
  cell.textContent = text;
  return cell;
}

function findRecord(teamNo, period, workType) {
  return state.records.find(
    (record) => record.teamNo === teamNo && record.period === period && record.workType === workType,
  );
}

function getTeamTotal(teamNo) {
  return state.records
    .filter((record) => record.teamNo === teamNo)
    .reduce((sum, record) => sum + Number(record.actualQty || 0), 0);
}

function getGrandTotal() {
  return state.records.reduce((sum, record) => sum + Number(record.actualQty || 0), 0);
}

function getAdminRowTotal(item) {
  return PERIODS.flatMap((period) => WORK_TYPES.map((type) => item.values[period.key][type.key])).reduce(
    (sum, value) => sum + Number(value || 0),
    0,
  );
}

function getAdminTypeTotal(period, workType) {
  return state.adminRows.reduce((sum, row) => sum + Number(row.values[period][workType] || 0), 0);
}

function getAdminGrandTotal() {
  return state.adminRows.reduce((sum, row) => sum + getAdminRowTotal(row), 0);
}

function downloadAdminExcel() {
  const headerRows = [["날짜", "조", "오전 합동", "오전 이전", "오전 기존", "오후 합동", "오후 이전", "오후 기존", "합계"]];
  const bodyRows = state.adminRows.map((row) => [
    row.workDate,
    `${row.teamNo}조`,
    ...PERIODS.flatMap((period) => WORK_TYPES.map((type) => row.values[period.key][type.key])),
    getAdminRowTotal(row),
  ]);
  bodyRows.push([
    "합계",
    "",
    ...PERIODS.flatMap((period) => WORK_TYPES.map((type) => getAdminTypeTotal(period.key, type.key))),
    getAdminGrandTotal(),
  ]);

  const rows = [...headerRows, ...bodyRows]
    .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(String(cell))}</td>`).join("")}</tr>`)
    .join("");
  const html = `<!doctype html><html><head><meta charset="UTF-8"></head><body><table>${rows}</table></body></html>`;
  const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `전체실적_${elements.adminDateFrom.value}_${elements.adminDateTo.value}.xls`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function toDbRecord(record) {
  return {
    work_date: record.workDate,
    team_no: record.teamNo,
    period: record.period,
    work_type: record.workType,
    actual_qty: record.actualQty,
    updated_by: state.user.id,
    updated_at: new Date().toISOString(),
  };
}

function fromDbRecord(record) {
  return {
    workDate: record.work_date,
    teamNo: record.team_no,
    period: record.period,
    workType: record.work_type,
    actualQty: record.actual_qty,
  };
}

function recordKey(record) {
  return `${record.workDate}:${record.teamNo}:${record.period}:${record.workType}`;
}

function normalizeSettings(settings) {
  return {
    teamCount: Math.max(1, Number(settings.teamCount || settings.team_count || defaultSettings.teamCount)),
  };
}

function readLocal(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback;
  } catch {
    return fallback;
  }
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
