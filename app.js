const CATEGORIES = [
  { name: "Food & drink", icon: "☕", color: "#78a986" },
  { name: "Transport", icon: "↗", color: "#e2a778" },
  { name: "Study", icon: "▤", color: "#8c9ed0" },
  { name: "Social", icon: "✳", color: "#d38eaa" },
  { name: "Essentials", icon: "⌂", color: "#dbbf68" },
  { name: "Other", icon: "·", color: "#a9b4ac" },
];

const STORAGE_KEYS = {
  expenses: "pocketwise.expenses.v1",
  budget: "pocketwise.budget.v1",
};

const money = new Intl.NumberFormat(undefined, { style: "currency", currency: "INR" });
const today = new Date();
const currentMonth = toMonthValue(today);
const monthFilter = document.querySelector("#month-filter");
const expenseDialog = document.querySelector("#expense-dialog");
const budgetDialog = document.querySelector("#budget-dialog");
const authDialog = document.querySelector("#auth-dialog");
const importDialog = document.querySelector("#import-dialog");
const expenseForm = document.querySelector("#expense-form");
const budgetForm = document.querySelector("#budget-form");
const authForm = document.querySelector("#auth-form");
const importForm = document.querySelector("#import-form");
const transactionList = document.querySelector("#transaction-list");
const supabaseConfig = window.POCKETWISE_SUPABASE_CONFIG;
const cloudConfigured = Boolean(
  supabaseConfig?.url && supabaseConfig?.anonKey &&
  /^https:\/\/[^/]+\.supabase\.co$/.test(supabaseConfig.url)
);
const supabaseClient = cloudConfigured && window.supabase?.createClient
  ? window.supabase.createClient(supabaseConfig.url, supabaseConfig.anonKey)
  : null;
let expenses = readExpenses();
let budget = readBudget();
let currentUser = null;
let authMode = "signin";
let cloudLoading = false;
let handledUserId = undefined;
let sessionGeneration = 0;

function toDateValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toMonthValue(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function createId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    return (character === "x" ? random : (random & 0x3) | 0x8).toString(16);
  });
}

function readExpenses() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.expenses) || "[]");
    if (!Array.isArray(saved)) throw new Error("Saved expenses must be a list.");
    return saved.filter((expense) =>
      expense && typeof expense.id === "string" &&
      typeof expense.description === "string" &&
      Number.isFinite(expense.amount) && expense.amount > 0 &&
      CATEGORIES.some((category) => category.name === expense.category) &&
      typeof expense.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(expense.date)
    );
  } catch (error) {
    console.error("Could not load saved expenses.", error);
    return [];
  }
}

function readBudget() {
  try {
    const saved = Number(localStorage.getItem(STORAGE_KEYS.budget));
    return Number.isFinite(saved) && saved >= 0 ? saved : 0;
  } catch (error) {
    console.error("Could not load the saved budget.", error);
    window.alert("Your saved budget could not be loaded. Check that browser storage is available.");
    return 0;
  }
}

function saveExpenses(value = expenses) {
  try {
    localStorage.setItem(STORAGE_KEYS.expenses, JSON.stringify(value));
  } catch (error) {
    console.error("Could not save expenses.", error);
    window.alert("Your expense could not be saved. Check that browser storage is available.");
    return false;
  }
  return true;
}

function saveBudget(value = budget) {
  try {
    localStorage.setItem(STORAGE_KEYS.budget, String(value));
  } catch (error) {
    console.error("Could not save your budget.", error);
    window.alert("Your budget could not be saved. Check that browser storage is available.");
    return false;
  }
  return true;
}

function hasLocalData() {
  return readExpenses().length > 0 || readBudget() > 0;
}

function showStatus(message, isError = false) {
  const status = document.querySelector("#sync-status");
  status.textContent = message;
  status.hidden = !message;
  status.classList.toggle("status-error", isError);
}

function showDialogMessage(element, message) {
  element.textContent = message;
  element.hidden = !message;
}

function updateAccountUI() {
  const authAction = document.querySelector("#auth-action");
  const importButton = document.querySelector("#import-local");
  const signOutButton = document.querySelector("#sign-out");
  const storageStatus = document.querySelector("#storage-status");
  const profileName = document.querySelector("#account-name");
  const profileDetail = document.querySelector("#account-detail");
  const avatar = document.querySelector("#account-avatar");

  if (currentUser) {
    authAction.textContent = "Sign out";
    importButton.hidden = !hasLocalData();
    signOutButton.hidden = false;
    profileName.textContent = currentUser.email || "Student account";
    profileDetail.textContent = "Cloud sync enabled";
    avatar.textContent = (currentUser.email || "S").slice(0, 1).toUpperCase();
    storageStatus.innerHTML = 'Synced to your account <span class="privacy-lock" aria-hidden="true">⌑</span>';
  } else {
    authAction.textContent = "Sign in to sync";
    importButton.hidden = true;
    signOutButton.hidden = true;
    profileName.textContent = "Student account";
    profileDetail.textContent = "On this device";
    avatar.textContent = "S";
    storageStatus.innerHTML = 'Stored on this device <span class="privacy-lock" aria-hidden="true">⌑</span>';
  }

  document.querySelector("#budget-hint").textContent = currentUser
    ? "Your budget is synced to your account."
    : "Your budget is saved just on this device.";
}

function reportError(action, error, target = null) {
  console.error(`Could not ${action}.`, error);
  const message = `Could not ${action}. ${error?.message || "Please try again."}`;
  if (target) showDialogMessage(target, message);
  else showStatus(message, true);
}

async function loadCloudData() {
  const [expenseResult, settingsResult] = await Promise.all([
    supabaseClient.from("expenses")
      .select("id, description, amount, category, date")
      .order("date", { ascending: false }),
    supabaseClient.from("user_settings")
      .select("monthly_budget")
      .maybeSingle(),
  ]);
  if (expenseResult.error) throw expenseResult.error;
  if (settingsResult.error) throw settingsResult.error;

  return {
    expenses: expenseResult.data.map((expense) => ({
      id: expense.id,
      description: expense.description,
      amount: Number(expense.amount),
      category: expense.category,
      date: expense.date,
    })),
    budget: settingsResult.data ? Number(settingsResult.data.monthly_budget) : 0,
  };
}

async function handleAuthSession(session) {
  const nextUser = session?.user || null;
  const nextUserId = nextUser?.id || null;
  if (handledUserId === nextUserId) return;
  const generation = ++sessionGeneration;
  handledUserId = nextUserId;
  currentUser = nextUser;
  updateAccountUI();

  if (!currentUser) {
    cloudLoading = false;
    expenses = readExpenses();
    budget = readBudget();
    render();
    showStatus("");
    return;
  }

  cloudLoading = true;
  expenses = [];
  budget = 0;
  render();
  showStatus("Loading your synced expenses…");
  try {
    const cloudData = await loadCloudData();
    if (generation !== sessionGeneration) return;
    expenses = cloudData.expenses;
    budget = cloudData.budget;
    render();
    showStatus("");
  } catch (error) {
    if (generation !== sessionGeneration) return;
    reportError("load your account data", error);
    render();
  } finally {
    if (generation === sessionGeneration) cloudLoading = false;
  }
}

async function signOut() {
  if (!supabaseClient) return;
  try {
    const { error } = await supabaseClient.auth.signOut();
    if (error) throw error;
  } catch (error) {
    reportError("sign out", error);
  }
}

function setAuthMode(mode) {
  authMode = mode;
  const signingUp = mode === "signup";
  document.querySelector("#auth-dialog-title").textContent = signingUp ? "Create your account" : "Sign in to sync";
  document.querySelector("#auth-submit").innerHTML = signingUp
    ? 'Create account <span aria-hidden="true">↗</span>'
    : 'Sign in <span aria-hidden="true">↗</span>';
  document.querySelector("#auth-mode-toggle").textContent = signingUp
    ? "Already have an account? Sign in"
    : "New here? Create an account";
  authForm.elements.password.autocomplete = signingUp ? "new-password" : "current-password";
}

function openAuthDialog() {
  authForm.reset();
  showDialogMessage(document.querySelector("#auth-message"), "");
  const setup = document.querySelector("#auth-setup");
  setup.hidden = Boolean(supabaseClient);
  if (cloudConfigured && !supabaseClient) {
    setup.textContent = "The Supabase browser library could not load. Check your internet connection and reload the app.";
  } else {
    setup.textContent = "Cloud sync is not configured yet. Follow the Supabase setup steps in the README, then add your project URL and publishable key to config.js. Never put a service-role key in this app.";
  }
  document.querySelector("#auth-form").querySelectorAll("input, #auth-submit, #auth-mode-toggle, #google-sign-in")
    .forEach((element) => { element.disabled = !supabaseClient; });
  setAuthMode("signin");
  authDialog.showModal();
}

function openImportDialog() {
  document.querySelector("#local-expense-count").textContent = String(readExpenses().length);
  showDialogMessage(document.querySelector("#import-message"), "");
  importDialog.showModal();
}

async function importLocalData() {
  if (!currentUser || !supabaseClient) return;

  const importingUserId = currentUser.id;
  const importMessage = document.querySelector("#import-message");
  const confirmButton = document.querySelector("#confirm-import");
  confirmButton.disabled = true;
  showDialogMessage(importMessage, "");
  try {
    const savedExpenses = readExpenses();
    const localExpenses = savedExpenses.map((expense) => ({
      ...expense,
      id: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(expense.id)
        ? expense.id
        : createId(),
    }));
    if (localExpenses.some((expense, index) => expense.id !== savedExpenses[index].id) &&
        !saveExpenses(localExpenses)) {
      throw new Error("Could not prepare the local records for import.");
    }

    for (let index = 0; index < localExpenses.length; index += 250) {
      const batch = localExpenses.slice(index, index + 250).map((expense) => ({
        id: expense.id,
        description: expense.description,
        amount: expense.amount,
        category: expense.category,
        date: expense.date,
      }));
      if (batch.length === 0) continue;
      const { error } = await supabaseClient.from("expenses").upsert(batch, { onConflict: "id" });
      if (error) throw error;
      if (currentUser?.id !== importingUserId) return;
    }

    const { error: settingsError } = await supabaseClient.from("user_settings").upsert({
      user_id: currentUser.id,
      monthly_budget: readBudget(),
    }, { onConflict: "user_id" });
    if (settingsError) throw settingsError;
    if (currentUser?.id !== importingUserId) return;

    const cloudData = await loadCloudData();
    if (currentUser?.id !== importingUserId) return;
    expenses = cloudData.expenses;
    budget = cloudData.budget;
    render();
    updateAccountUI();
    importDialog.close();
    showStatus(`Imported ${localExpenses.length} ${localExpenses.length === 1 ? "expense" : "expenses"} and your budget.`);
  } catch (error) {
    reportError("import your local data", error, importMessage);
  } finally {
    confirmButton.disabled = false;
  }
}

function formatDate(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" })
    .format(new Date(year, month - 1, day));
}

function filteredExpenses() {
  const month = monthFilter.value;
  return expenses
    .filter((expense) => !month || expense.date.startsWith(month))
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
}

function renderSummary(monthExpenses) {
  const spent = monthExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  const remaining = budget - spent;
  const count = monthExpenses.length;
  document.querySelector("#month-total").textContent = money.format(spent);
  document.querySelector("#expense-count").textContent = `${count} ${count === 1 ? "expense" : "expenses"}`;
  document.querySelector("#budget-total").textContent = money.format(budget);
  document.querySelector("#remaining-total").textContent = money.format(Math.max(0, remaining));

  const progress = budget > 0 ? Math.min(100, (spent / budget) * 100) : 0;
  document.querySelector("#budget-progress").style.width = `${progress}%`;
  const budgetNote = document.querySelector("#budget-note");
  budgetNote.textContent = budget === 0
    ? "Set a budget to keep your spending on track."
    : spent > budget
      ? `${money.format(spent - budget)} over your monthly budget`
      : `${progress.toFixed(0)}% of your budget used`;
  document.querySelector("#remaining-note").textContent = budget === 0
    ? "Set a budget to see what you have left."
    : spent > budget
      ? "You’ve gone over this month’s budget."
      : "Your budget, minus what you’ve spent.";
}

function renderChart(monthExpenses) {
  const daily = new Map();
  for (const expense of monthExpenses) {
    const day = Number(expense.date.slice(8, 10));
    daily.set(day, (daily.get(day) || 0) + expense.amount);
  }

  const month = monthFilter.value || currentMonth;
  const [year, monthNumber] = month.split("-").map(Number);
  const daysInMonth = new Date(year, monthNumber, 0).getDate();
  const weekCount = Math.ceil(daysInMonth / 7);
  const weekly = Array.from({ length: weekCount }, (_, index) => {
    const firstDay = index * 7 + 1;
    const lastDay = Math.min(firstDay + 6, daysInMonth);
    let amount = 0;
    for (let day = firstDay; day <= lastDay; day += 1) amount += daily.get(day) || 0;
    return { firstDay, lastDay, amount };
  });
  const max = Math.max(1, ...weekly.map((week) => week.amount));
  const chart = document.querySelector("#daily-chart");
  chart.replaceChildren();

  for (const week of weekly) {
    const value = week.amount;
    const column = document.createElement("div");
    column.className = "chart-column";
    const bar = document.createElement("div");
    bar.className = "chart-bar";
    bar.dataset.value = String(value);
    bar.style.height = `${value === 0 ? 3 : Math.max(7, (value / max) * 100)}%`;
    bar.setAttribute("aria-label", `${money.format(value)} from day ${week.firstDay} to ${week.lastDay}`);
    const tooltip = document.createElement("span");
    tooltip.textContent = money.format(value);
    bar.append(tooltip);
    column.append(bar);
    chart.append(column);
  }

  const total = monthExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  const monthName = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(new Date(year, monthNumber - 1, 1));
  document.querySelector("#chart-caption").textContent = monthName;
  document.querySelector("#chart-total").textContent = money.format(total);
  document.querySelector("#y-label-1").textContent = money.format(max);
  document.querySelector("#y-label-2").textContent = money.format(max * 0.66);
  document.querySelector("#y-label-3").textContent = money.format(max * 0.33);
  document.querySelector(".chart-y-labels span:last-child").textContent = money.format(0);
  document.querySelector("#chart-labels").innerHTML = weekly.map((week) => `<span>${week.firstDay}–${week.lastDay}</span>`).join("");
  chart.setAttribute("aria-label", `Weekly expenses chart for ${monthName}`);
}

function renderCategories(monthExpenses) {
  const totals = new Map(CATEGORIES.map((category) => [category.name, 0]));
  for (const expense of monthExpenses) {
    totals.set(expense.category, (totals.get(expense.category) || 0) + expense.amount);
  }
  const grandTotal = [...totals.values()].reduce((sum, amount) => sum + amount, 0);
  document.querySelector("#category-total").textContent = money.format(grandTotal);
  const segments = [];
  let position = 0;
  for (const category of CATEGORIES) {
    const amount = totals.get(category.name);
    if (amount === 0 || grandTotal === 0) continue;
    const next = position + (amount / grandTotal) * 100;
    segments.push(`${category.color} ${position}% ${next}%`);
    position = next;
  }
  document.querySelector("#category-donut").style.background = grandTotal > 0
    ? `conic-gradient(${segments.join(", ")})`
    : "conic-gradient(#e9eee8 0 100%)";

  const legend = document.querySelector("#category-legend");
  legend.replaceChildren();
  for (const category of CATEGORIES) {
    const amount = totals.get(category.name);
    if (amount === 0) continue;
    const item = document.createElement("div");
    item.className = "category-item";
    const swatch = document.createElement("span");
    swatch.className = "category-swatch";
    swatch.style.backgroundColor = category.color;
    const name = document.createElement("span");
    name.textContent = category.name;
    const value = document.createElement("strong");
    value.textContent = money.format(amount);
    item.append(swatch, name, value);
    legend.append(item);
  }
  if (legend.childElementCount === 0) {
    const empty = document.createElement("span");
    empty.className = "category-item";
    empty.textContent = "Your categories will show here.";
    legend.append(empty);
  }
}

function renderTransactions() {
  const query = document.querySelector("#search-transactions").value.trim().toLowerCase();
  const category = document.querySelector("#category-filter").value;
  const shown = filteredExpenses().filter((expense) =>
    (!category || expense.category === category) &&
    (!query || `${expense.description} ${expense.category}`.toLowerCase().includes(query))
  );
  transactionList.replaceChildren();
  for (const expense of shown) {
    const row = document.createElement("tr");
    const transaction = document.createElement("td");
    const transactionName = document.createElement("div");
    transactionName.className = "transaction-name";
    const icon = document.createElement("span");
    icon.className = "transaction-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = CATEGORIES.find((item) => item.name === expense.category)?.icon || "·";
    const description = document.createElement("span");
    description.textContent = expense.description;
    transactionName.append(icon, description);
    transaction.append(transactionName);

    const categoryCell = document.createElement("td");
    const pill = document.createElement("span");
    pill.className = "category-pill";
    pill.textContent = expense.category;
    categoryCell.append(pill);
    const dateCell = document.createElement("td");
    dateCell.textContent = formatDate(expense.date);
    const amountCell = document.createElement("td");
    amountCell.className = "amount-cell";
    amountCell.textContent = `−${money.format(expense.amount)}`;
    const actionCell = document.createElement("td");
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "delete-expense";
    remove.dataset.expenseId = expense.id;
    remove.setAttribute("aria-label", `Delete ${expense.description}`);
    remove.textContent = "×";
    actionCell.append(remove);
    row.append(transaction, categoryCell, dateCell, amountCell, actionCell);
    transactionList.append(row);
  }

  document.querySelector("#empty-state").hidden = shown.length > 0;
  document.querySelector("#transaction-count").textContent =
    `Showing ${shown.length} ${shown.length === 1 ? "transaction" : "transactions"}`;
}

function render() {
  const monthExpenses = filteredExpenses();
  renderSummary(monthExpenses);
  renderChart(monthExpenses);
  renderCategories(monthExpenses);
  renderTransactions();
}

function openExpenseDialog() {
  if (cloudLoading) {
    showStatus("Your account data is still loading. Please wait.");
    return;
  }
  document.querySelector("#form-error").hidden = true;
  expenseForm.reset();
  expenseForm.elements.date.value = toDateValue(today);
  expenseDialog.showModal();
  expenseForm.elements.description.focus();
}

for (const category of CATEGORIES) {
  const option = document.createElement("option");
  option.value = category.name;
  option.textContent = category.name;
  expenseForm.elements.category.append(option);
  const filterOption = option.cloneNode(true);
  document.querySelector("#category-filter").append(filterOption);
}

monthFilter.value = currentMonth;
document.querySelector("#today-label").textContent = new Intl.DateTimeFormat(undefined, {
  weekday: "short", month: "short", day: "numeric",
}).format(today);
document.querySelector("#open-expense").addEventListener("click", openExpenseDialog);
document.querySelector("#empty-add-expense").addEventListener("click", openExpenseDialog);
document.querySelector("#close-dialog").addEventListener("click", () => expenseDialog.close());
document.querySelector("#cancel-dialog").addEventListener("click", () => expenseDialog.close());
document.querySelector("#edit-budget").addEventListener("click", () => {
  if (cloudLoading) {
    showStatus("Your account data is still loading. Please wait.");
    return;
  }
  showDialogMessage(document.querySelector("#budget-error"), "");
  budgetForm.elements.budget.value = budget > 0 ? String(budget) : "";
  budgetDialog.showModal();
});
document.querySelector("#close-budget-dialog").addEventListener("click", () => budgetDialog.close());
document.querySelector("#cancel-budget").addEventListener("click", () => budgetDialog.close());
document.querySelector("#auth-action").addEventListener("click", () => {
  if (currentUser) void signOut();
  else openAuthDialog();
});
document.querySelector("#sign-out").addEventListener("click", () => void signOut());
document.querySelector("#import-local").addEventListener("click", openImportDialog);
document.querySelector("#close-auth-dialog").addEventListener("click", () => authDialog.close());
document.querySelector("#close-import-dialog").addEventListener("click", () => importDialog.close());
document.querySelector("#cancel-import").addEventListener("click", () => importDialog.close());
document.querySelector("#auth-mode-toggle").addEventListener("click", () => {
  setAuthMode(authMode === "signin" ? "signup" : "signin");
  showDialogMessage(document.querySelector("#auth-message"), "");
});
document.querySelector("#google-sign-in").addEventListener("click", async () => {
  const message = document.querySelector("#auth-message");
  if (!supabaseClient) {
    showDialogMessage(message, "Configure Supabase and reload the app before signing in.");
    return;
  }

  const button = document.querySelector("#google-sign-in");
  button.disabled = true;
  showDialogMessage(message, "");
  try {
    const { error } = await supabaseClient.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}${window.location.pathname}`,
      },
    });
    if (error) throw error;
  } catch (error) {
    const description = String(error?.message || "").toLowerCase().includes("provider")
      ? "Google sign-in needs to be enabled in Supabase with Google OAuth credentials. Follow the Google setup steps in the README."
      : `Could not sign in with Google. ${error?.message || "Please try again."}`;
    console.error("Could not sign in with Google.", error);
    showDialogMessage(message, description);
    button.disabled = false;
  }
});
importForm.addEventListener("submit", (event) => {
  event.preventDefault();
  void importLocalData();
});
monthFilter.addEventListener("change", render);
document.querySelector("#search-transactions").addEventListener("input", renderTransactions);
document.querySelector("#category-filter").addEventListener("change", renderTransactions);
transactionList.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-expense-id]");
  if (!button || cloudLoading) return;
  const userId = currentUser?.id;
  const expenseId = button.dataset.expenseId;
  try {
    if (currentUser) {
      const { data, error } = await supabaseClient.from("expenses")
        .delete()
        .eq("id", expenseId)
        .select("id");
      if (error) throw error;
      if (!data.length) throw new Error("This expense was not found in your account.");
      if (currentUser?.id !== userId) return;
      expenses = expenses.filter((expense) => expense.id !== expenseId);
    } else {
      const nextExpenses = expenses.filter((expense) => expense.id !== expenseId);
      if (!saveExpenses(nextExpenses)) return;
      expenses = nextExpenses;
    }
    render();
    showStatus("");
  } catch (error) {
    reportError("delete the expense", error);
  }
});

expenseForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (cloudLoading) return;
  const formData = new FormData(expenseForm);
  const amount = Number(formData.get("amount"));
  if (!Number.isFinite(amount) || amount <= 0) {
    const error = document.querySelector("#form-error");
    error.textContent = "Enter an amount greater than zero.";
    error.hidden = false;
    return;
  }
  const expense = {
    id: createId(),
    description: String(formData.get("description")).trim(),
    amount: Math.round(amount * 100) / 100,
    category: String(formData.get("category")),
    date: String(formData.get("date")),
  };
  if (!expense.description || !/^\d{4}-\d{2}-\d{2}$/.test(expense.date)) {
    const error = document.querySelector("#form-error");
    error.textContent = "Add a description and choose a valid date.";
    error.hidden = false;
    return;
  }
  const submitButton = expenseForm.querySelector('button[type="submit"]');
  const userId = currentUser?.id;
  submitButton.disabled = true;
  try {
    if (currentUser) {
      const { data, error } = await supabaseClient.from("expenses")
        .insert({
          description: expense.description,
          amount: expense.amount,
          category: expense.category,
          date: expense.date,
        })
        .select("id, description, amount, category, date")
        .single();
      if (error) throw error;
      if (currentUser?.id !== userId) {
        expenseDialog.close();
        return;
      }
      expenses.push({ ...data, amount: Number(data.amount) });
    } else {
      const nextExpenses = [...expenses, expense];
      if (!saveExpenses(nextExpenses)) return;
      expenses = nextExpenses;
    }
    monthFilter.value = expense.date.slice(0, 7);
    expenseDialog.close();
    render();
    showStatus("");
  } catch (error) {
    reportError("save the expense", error, document.querySelector("#form-error"));
  } finally {
    submitButton.disabled = false;
  }
});

budgetForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (cloudLoading) return;
  const value = Number(budgetForm.elements.budget.value);
  if (!Number.isFinite(value) || value < 0) {
    showDialogMessage(document.querySelector("#budget-error"), "Enter a valid budget amount.");
    return;
  }
  const amount = Math.round(value * 100) / 100;
  const submitButton = budgetForm.querySelector('button[type="submit"]');
  const userId = currentUser?.id;
  submitButton.disabled = true;
  try {
    if (currentUser) {
      const { error } = await supabaseClient.from("user_settings").upsert({
        user_id: currentUser.id,
        monthly_budget: amount,
      }, { onConflict: "user_id" });
      if (error) throw error;
      if (currentUser?.id !== userId) {
        budgetDialog.close();
        return;
      }
    } else if (!saveBudget(amount)) {
      return;
    }
    budget = amount;
    budgetDialog.close();
    render();
    showStatus("");
  } catch (error) {
    reportError("save your budget", error, document.querySelector("#budget-error"));
  } finally {
    submitButton.disabled = false;
  }
});

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = document.querySelector("#auth-message");
  if (!supabaseClient) {
    showDialogMessage(message, "Configure Supabase and reload the app before signing in.");
    return;
  }

  const submitButton = document.querySelector("#auth-submit");
  submitButton.disabled = true;
  showDialogMessage(message, "");
  try {
    const email = String(new FormData(authForm).get("email")).trim();
    const password = String(new FormData(authForm).get("password"));
    const result = authMode === "signup"
      ? await supabaseClient.auth.signUp({ email, password })
      : await supabaseClient.auth.signInWithPassword({ email, password });
    if (result.error) throw result.error;
    if (authMode === "signup" && !result.data.session) {
      showDialogMessage(message, "Account created. Check your email to confirm your account, then sign in.");
      return;
    }
    authDialog.close();
  } catch (error) {
    reportError(authMode === "signup" ? "create your account" : "sign in", error, message);
  } finally {
    submitButton.disabled = false;
  }
});

updateAccountUI();
render();
if (supabaseClient) {
  supabaseClient.auth.onAuthStateChange((_event, session) => {
    queueMicrotask(() => { void handleAuthSession(session); });
  });
  supabaseClient.auth.getSession().then(({ data, error }) => {
    if (error) {
      reportError("restore your sign-in session", error);
      return;
    }
    return handleAuthSession(data.session);
  }).catch((error) => reportError("restore your sign-in session", error));
} else if (supabaseConfig?.url || supabaseConfig?.anonKey) {
  showStatus("Cloud sync is configured but the Supabase library could not load. Check your internet connection.");
}
