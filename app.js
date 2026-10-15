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
const expenseForm = document.querySelector("#expense-form");
const budgetForm = document.querySelector("#budget-form");
const transactionList = document.querySelector("#transaction-list");
let expenses = readExpenses();
let budget = readBudget();

function toDateValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toMonthValue(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
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
  const saved = Number(localStorage.getItem(STORAGE_KEYS.budget));
  return Number.isFinite(saved) && saved >= 0 ? saved : 0;
}

function saveExpenses() {
  try {
    localStorage.setItem(STORAGE_KEYS.expenses, JSON.stringify(expenses));
  } catch (error) {
    console.error("Could not save expenses.", error);
    window.alert("Your expense could not be saved. Check that browser storage is available.");
    return false;
  }
  return true;
}

function saveBudget() {
  try {
    localStorage.setItem(STORAGE_KEYS.budget, String(budget));
  } catch (error) {
    console.error("Could not save your budget.", error);
    window.alert("Your budget could not be saved. Check that browser storage is available.");
    return false;
  }
  return true;
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
  budgetForm.elements.budget.value = budget > 0 ? String(budget) : "";
  budgetDialog.showModal();
});
document.querySelector("#close-budget-dialog").addEventListener("click", () => budgetDialog.close());
document.querySelector("#cancel-budget").addEventListener("click", () => budgetDialog.close());
monthFilter.addEventListener("change", render);
document.querySelector("#search-transactions").addEventListener("input", renderTransactions);
document.querySelector("#category-filter").addEventListener("change", renderTransactions);
transactionList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-expense-id]");
  if (!button) return;
  const previous = expenses;
  expenses = expenses.filter((expense) => expense.id !== button.dataset.expenseId);
  if (!saveExpenses()) {
    expenses = previous;
    return;
  }
  render();
});

expenseForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(expenseForm);
  const amount = Number(formData.get("amount"));
  if (!Number.isFinite(amount) || amount <= 0) {
    const error = document.querySelector("#form-error");
    error.textContent = "Enter an amount greater than zero.";
    error.hidden = false;
    return;
  }
  const expense = {
    id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
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
  expenses.push(expense);
  if (!saveExpenses()) {
    expenses.pop();
    return;
  }
  monthFilter.value = expense.date.slice(0, 7);
  expenseDialog.close();
  render();
});

budgetForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const value = Number(budgetForm.elements.budget.value);
  if (!Number.isFinite(value) || value < 0) return;
  const previous = budget;
  budget = Math.round(value * 100) / 100;
  if (!saveBudget()) {
    budget = previous;
    return;
  }
  budgetDialog.close();
  render();
});

render();
