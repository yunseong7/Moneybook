import { auth, db } from "./firebase-config.js";

import {
    collection,
    addDoc,
    getDocs,
    query,
    orderBy,
    doc,
    updateDoc,
    deleteDoc
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const incomeCategories = ["급여", "세이프박스 출금", "용돈", "부가수입", "기타"];
const expenseCategories = ["개인", "피어스(밥 + 음료)", "식비", "심부름", "커피 / 음료", "세이프박스 입금", "교통비", "경조사", "고정비", "기타"];

const categoryIcons = {
    "급여": "₩",
    "세이프박스 출금": "▣",
    "용돈": "♡",
    "부가수입": "+",
    "개인": "☺",
    "피어스(밥 + 음료)": "🍴",
    "식비": "🍴",
    "심부름": "→",
    "커피 / 음료": "☕",
    "세이프박스 입금": "▣",
    "교통비": "🚌",
    "경조사": "✿",
    "고정비": "⌂",
    "기타": "···"
};

let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth() + 1;
let allTransactions = [];
let editingId = null;
let selectedCalendarDate = "";
let historyFilterStart = "";
let historyFilterEnd = "";
let historyFilterType = "all";
let historyFilterCategory = "";
let historySearch = "";
let historyPeriod = "this_month";
let categoryPage = 0;
const CATEGORY_PAGE_SIZE = 4;

const isRichUI = () => $("#calendarBody").length > 0;

function formatPlain(amount) {
    return Math.round(Math.abs(Number(amount) || 0)).toLocaleString("ko-KR");
}

function formatPlainWon(amount) {
    return `${formatPlain(amount)}원`;
}

function formatSignedPlain(amount) {
    const num = Number(amount) || 0;
    const sign = num > 0 ? "+" : num < 0 ? "-" : "";
    return `${sign}${formatPlain(num)}원`;
}

function formatAmount(amount) {
    return formatPlainWon(amount);
}

function formatAmountHtml(amount) {
    return `${formatPlain(amount)}<mark>원</mark>`;
}

function formatSignedAmount(amount) {
    return formatSignedPlain(amount);
}

function formatSignedAmountHtml(amount) {
    const num = Number(amount) || 0;
    const sign = num > 0 ? "+" : num < 0 ? "-" : "";
    return `${sign}${formatPlain(num)}<mark>원</mark>`;
}

function getMonthPrefix(year = currentYear, month = currentMonth) {
    return `${year}-${String(month).padStart(2, "0")}`;
}

function formatDateYMD(year, month, day) {
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function getTodayYMD() {
    const today = new Date();
    return formatDateYMD(today.getFullYear(), today.getMonth() + 1, today.getDate());
}

function formatDateChip(dateStr) {
    if (!dateStr) return "날짜 선택";

    const weekdayNames = ["일", "월", "화", "수", "목", "금", "토"];
    const [year, month, day] = dateStr.split("-").map(Number);
    const weekday = weekdayNames[new Date(year, month - 1, day).getDay()];

    return `${month}월 ${day}일 ${weekday}`;
}

function formatPeekTitle(dateStr) {
    const weekdayNames = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];
    const [year, month, day] = dateStr.split("-").map(Number);
    const weekday = weekdayNames[new Date(year, month - 1, day).getDay()];

    return `${month}월 ${day}일 ${weekday}`;
}

function formatHistoryDateHeader(dateStr) {
    const weekdayNames = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];
    const [year, month, day] = dateStr.split("-").map(Number);
    const weekday = weekdayNames[new Date(year, month - 1, day).getDay()];

    return `${month}월 ${day}일 ${weekday}`;
}

function formatTime(createdAt) {
    if (!createdAt) return "";

    const date = new Date(createdAt);
    if (Number.isNaN(date.getTime())) return "";

    return date.toLocaleTimeString("ko-KR", { hour: "numeric", minute: "2-digit" });
}

function getMonthRange(year, month) {
    return {
        start: formatDateYMD(year, month, 1),
        end: formatDateYMD(year, month, new Date(year, month, 0).getDate())
    };
}

function getThisMonthRange() {
    const today = new Date();
    return getMonthRange(today.getFullYear(), today.getMonth() + 1);
}

function getLastMonthRange() {
    const today = new Date();
    const date = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    return getMonthRange(date.getFullYear(), date.getMonth() + 1);
}

function getThisYearRange() {
    const year = new Date().getFullYear();
    return {
        start: formatDateYMD(year, 1, 1),
        end: formatDateYMD(year, 12, 31)
    };
}

function getTransactionsByRange(start, end) {
    return allTransactions.filter(t => t.date && t.date >= start && t.date <= end);
}

function sumByType(transactions) {
    let income = 0;
    let expense = 0;

    transactions.forEach(t => {
        if (t.type === "income") income += t.amount;
        else expense += t.amount;
    });

    return { income, expense, total: income - expense };
}

function formatDelta(current, previous) {
    if (!previous) {
        return current ? "신규" : "";
    }

    const rate = ((current - previous) / previous) * 100;
    const sign = rate > 0 ? "+" : "";
    return `${sign}${rate.toFixed(1)}% vs 지난 달`;
}

function initHistoryFilter() {
    applyHistoryPeriod("this_month", true);
    historyFilterType = "all";
    historyFilterCategory = "";
    $(".btn_history_type").removeClass("is_active");
    $('.btn_history_type[data-history-type="all"]').addClass("is_active");
    populateHistoryCategoryOptions();
    $("#historyFilterError").hide();
}

export function applyHistoryPeriod(period, silent) {
    historyPeriod = period;
    $(".btn_period").removeClass("is_active");
    $(`.btn_period[data-period="${period}"]`).addClass("is_active");

    let range = getThisMonthRange();

    if (period === "last_month") range = getLastMonthRange();
    if (period === "this_year") range = getThisYearRange();

    if (period !== "custom") {
        historyFilterStart = range.start;
        historyFilterEnd = range.end;
        $("#historyStartDate").val(range.start);
        $("#historyEndDate").val(range.end);
        $("#historyFilterPanel").removeClass("is_open");
    } else {
        $("#historyFilterPanel").addClass("is_open");
    }

    if (!silent) renderHistoryPanel();
}

function populateHistoryCategoryOptions() {
    const $select = $("#historyCategory");
    if (!$select.length) return;

    if (historyFilterType === "all") {
        historyFilterCategory = "";
        $select.empty().append('<option value="">전체 카테고리</option>').val("").prop("disabled", true);
        return;
    }

    const list = historyFilterType === "income" ? incomeCategories : expenseCategories;
    $select.prop("disabled", false).empty().append('<option value="">전체 카테고리</option>');

    list.forEach(category => {
        $select.append(`<option value="${category}">${category}</option>`);
    });

    if (historyFilterCategory && list.includes(historyFilterCategory)) {
        $select.val(historyFilterCategory);
    } else {
        historyFilterCategory = "";
        $select.val("");
    }
}

function syncHistoryFiltersFromUI() {
    historyFilterType = $(".btn_history_type.is_active").data("history-type") || "all";
    historyFilterCategory = historyFilterType === "all" ? "" : ($("#historyCategory").val() || "");
}

function getHistoryPeriodTransactions() {
    if (!historyFilterStart || !historyFilterEnd) {
        return getMonthTransactions();
    }

    return getTransactionsByRange(historyFilterStart, historyFilterEnd);
}

function getHistoryTransactions() {
    const keyword = historySearch.trim().toLowerCase();

    return getHistoryPeriodTransactions().filter(t => {
        if (historyFilterType !== "all" && t.type !== historyFilterType) return false;
        if (historyFilterCategory && t.category !== historyFilterCategory) return false;
        if (keyword) {
            const hay = `${t.category || ""} ${t.memo || ""}`.toLowerCase();
            if (!hay.includes(keyword)) return false;
        }
        return true;
    });
}

function formatDaySummary(transactions) {
    const { total } = sumByType(transactions);
    return formatSignedPlain(total);
}

function buildPeekItem(t) {
    const sign = t.type === "income" ? "+" : "-";
    const typeClass = t.type === "income" ? "is_income" : "is_expense";
    const time = formatTime(t.createdAt);
    const sub = [time, t.memo].filter(Boolean).join(" · ");

    return `
        <li class="item_peek" data-id="${t.id || ""}">
            <div class="box_peek_left">
                <span class="icon_category">${categoryIcons[t.category] || "·"}</span>
                <div>
                    <span class="txt_peek_category">${t.category}</span>
                    ${sub ? `<span class="txt_peek_sub">${sub}</span>` : ""}
                </div>
            </div>
            <div class="area_peek_right">
                <span class="txt_peek_amount ${typeClass}">${sign}${formatPlainWon(t.amount)}</span>
                ${t.id ? `<div class="area_transaction_actions">
                    <button type="button" class="btn_transaction btn_transaction_edit" data-id="${t.id}">수정</button>
                    <button type="button" class="btn_transaction btn_transaction_delete" data-id="${t.id}">삭제</button>
                </div>` : ""}
            </div>
        </li>
    `;
}

function buildHistoryListItem(t) {
    const sign = t.type === "income" ? "+" : "-";
    const typeClass = t.type === "income" ? "is_income" : "is_expense";
    const time = formatTime(t.createdAt);
    const memo = t.memo || time;

    return `
        <li class="item_history" data-id="${t.id || ""}">
            <div class="box_history_item_left">
                <span class="icon_category">${categoryIcons[t.category] || "·"}</span>
                <div class="box_history_item_text">
                    <span class="txt_history_category">${t.category}</span>
                    ${memo ? `<span class="txt_history_memo">${memo}</span>` : ""}
                </div>
            </div>
            <div class="area_history_item_right">
                <span class="txt_history_amount ${typeClass}">${sign}${formatPlainWon(t.amount)}</span>
                ${t.id ? `<div class="area_transaction_actions">
                    <button type="button" class="btn_transaction btn_transaction_edit" data-id="${t.id}">수정</button>
                    <button type="button" class="btn_transaction btn_transaction_delete" data-id="${t.id}">삭제</button>
                </div>` : ""}
            </div>
        </li>
    `;
}

function updateHistorySummary() {
    if (!$("#historySummaryIncome").length) return;

    const { income, expense, total } = sumByType(getHistoryTransactions());
    $("#historySummaryIncome").text(formatPlainWon(income));
    $("#historySummaryExpense").text(formatPlainWon(expense));
    $("#historySummaryTotal").text(formatSignedPlain(total));
}

function renderHistoryPanel() {
    updateHistorySummary();
    renderTransactionList();
}

function applyHistoryFilter() {
    const start = $("#historyStartDate").val();
    const end = $("#historyEndDate").val();

    if (!start || !end) {
        if (!start) $("#historyStartDate").addClass("is_error");
        if (!end) $("#historyEndDate").addClass("is_error");
        return;
    }

    $("#historyStartDate, #historyEndDate").removeClass("is_error");

    if (start > end) {
        $("#historyFilterError").show();
        return;
    }

    historyFilterStart = start;
    historyFilterEnd = end;
    historyPeriod = "custom";
    $(".btn_period").removeClass("is_active");
    $('.btn_period[data-period="custom"]').addClass("is_active");
    syncHistoryFiltersFromUI();
    $("#historyFilterError").hide();
    renderHistoryPanel();
}

function switchHistoryType(type) {
    historyFilterType = type;
    historyFilterCategory = "";
    $(".btn_history_type").removeClass("is_active");
    $(`.btn_history_type[data-history-type="${type}"]`).addClass("is_active");
    populateHistoryCategoryOptions();
    if (historyFilterStart && historyFilterEnd) renderHistoryPanel();
}

export function setHistorySearch(value) {
    historySearch = value || "";
    renderHistoryPanel();
}

function getTransactionById(id) {
    return allTransactions.find(t => t.id === id);
}

export function loadCategories(selectedCategory) {
    const type = $("#type").val() || "expense";
    const list = type === "income" ? incomeCategories : expenseCategories;
    const chosen = selectedCategory && list.includes(selectedCategory) ? selectedCategory : list[0];

    $("#category").empty();
    $("#categoryChips").empty();
    $("#inputFormPanel").toggleClass("is_income_mode", type === "income");

    list.forEach(category => {
        $("#category").append(`<option value="${category}">${category}</option>`);
        $("#categoryChips").append(
            `<button type="button" class="btn_category_chip${category === chosen ? " is_active" : ""}" data-category="${category}">${category}</button>`
        );
    });

    $("#category").val(chosen || "");
    categoryPage = 0;

    if (chosen) {
        const chosenIndex = list.indexOf(chosen);
        if (chosenIndex >= 0) {
            categoryPage = Math.floor(chosenIndex / CATEGORY_PAGE_SIZE);
        }
    }

    renderCategoryPage();
}

function renderCategoryPage() {
    const $chips = $("#categoryChips .btn_category_chip");

    if (!isCompactLayout()) {
        $chips.removeClass("is_page_hidden");
        return;
    }

    const total = $chips.length;
    const maxPage = Math.max(0, Math.ceil(total / CATEGORY_PAGE_SIZE) - 1);

    if (categoryPage > maxPage) categoryPage = maxPage;
    if (categoryPage < 0) categoryPage = 0;

    const start = categoryPage * CATEGORY_PAGE_SIZE;
    const end = start + CATEGORY_PAGE_SIZE;

    $chips.each(function (index) {
        $(this).toggleClass("is_page_hidden", index < start || index >= end);
    });

    $("#categoryPrevBtn").prop("disabled", categoryPage <= 0);
    $("#categoryNextBtn").prop("disabled", categoryPage >= maxPage);
}

export function shiftCategoryPage(delta) {
    categoryPage += delta;
    renderCategoryPage();
}

export function selectCategory(category) {
    if (!category) return;

    $("#category").val(category);
    $(".btn_category_chip").removeClass("is_active");
    $(`.btn_category_chip[data-category="${category}"]`).addClass("is_active");
}

export function changeMonth(delta) {
    currentMonth += delta;

    if (currentMonth > 12) {
        currentMonth = 1;
        currentYear++;
    } else if (currentMonth < 1) {
        currentMonth = 12;
        currentYear--;
    }

    updateMonthDisplay();
    refreshUI();
}

export function goToToday() {
    const today = new Date();
    currentYear = today.getFullYear();
    currentMonth = today.getMonth() + 1;
    updateMonthDisplay();
    selectCalendarDate(getTodayYMD());
    refreshUI();
}

function updateMonthDisplay() {
    $(".txt_month").text(`${currentYear}년 ${currentMonth}월`);
}

function getMonthTransactions(year = currentYear, month = currentMonth) {
    const prefix = getMonthPrefix(year, month);
    return allTransactions.filter(t => t.date && t.date.startsWith(prefix));
}

function updateSummary() {
    if (!isRichUI()) return;

    const current = sumByType(getMonthTransactions());
    const prevDate = new Date(currentYear, currentMonth - 2, 1);
    const previous = sumByType(getMonthTransactions(prevDate.getFullYear(), prevDate.getMonth() + 1));

    $(".pill_income .txt_amount_income").text(formatPlain(current.income));
    $(".pill_expense .txt_amount_expense").text(formatPlain(current.expense));
    $(".txt_hero_total").text(formatSignedPlain(current.total));
    $(".card_bento_income .txt_bento_amount").text(formatPlainWon(current.income));
    $(".card_bento_expense .txt_bento_amount").text(formatPlainWon(current.expense));
    $(".card_bento_total .txt_bento_amount").text(formatSignedPlain(current.total));
    $("#incomeDelta").text(formatDelta(current.income, previous.income));
    $("#expenseDelta").text(formatDelta(current.expense, previous.expense));
    $("#totalDelta").text(formatDelta(current.total, previous.total));
}

function renderCalendar() {
    const grid = $("#calendarBody");
    if (!grid.length) return;

    const firstDay = new Date(currentYear, currentMonth - 1, 1);
    const lastDay = new Date(currentYear, currentMonth, 0);
    const startPad = firstDay.getDay();
    const daysInMonth = lastDay.getDate();
    const todayStr = getTodayYMD();
    const selectedDate = selectedCalendarDate || $("#date").val();
    const byDate = {};

    getMonthTransactions().forEach(t => {
        if (!byDate[t.date]) byDate[t.date] = { income: 0, expense: 0 };
        if (t.type === "income") byDate[t.date].income += t.amount;
        else byDate[t.date].expense += t.amount;
    });

    let html = "";
    let cellCount = 0;

    for (let i = 0; i < startPad; i++) {
        html += '<div class="cell_day cell_day_empty" role="gridcell" aria-hidden="true"></div>';
        cellCount++;
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = formatDateYMD(currentYear, currentMonth, day);
        const data = byDate[dateStr];
        const total = data ? data.income - data.expense : 0;
        const classes = ["cell_day"];

        if (dateStr === selectedDate) classes.push("is_selected");
        if (dateStr === todayStr) classes.push("is_today");

        html += `<div class="${classes.join(" ")}" data-date="${dateStr}" role="gridcell">`;
        html += `<span class="txt_day">${day}</span>`;

        if (data) {
            const dotClass = data.expense && !data.income ? "" : data.income && !data.expense ? " is_income" : "";
            html += `<span class="dot_day${dotClass}"></span>`;
            if (total) {
                html += `<span class="txt_day_net ${total > 0 ? "is_income" : "is_expense"}">${total > 0 ? "+" : "-"}${formatPlain(total)}</span>`;
            }
        }

        html += "</div>";
        cellCount++;
    }

    while (cellCount % 7 !== 0) {
        html += '<div class="cell_day cell_day_empty" role="gridcell" aria-hidden="true"></div>';
        cellCount++;
    }

    grid.html(html);
    grid.get(0).style.setProperty("--calendar-rows", Math.ceil(cellCount / 7));
}

function getTransactionsByDate(dateStr) {
    return allTransactions.filter(t => t.date === dateStr);
}

function renderDayPeek(dateStr) {
    const peekDate = dateStr || selectedCalendarDate || getTodayYMD();
    if (!$("#dayPeek").length) return;

    const dayTransactions = getTransactionsByDate(peekDate)
        .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

    $("#dayPeekTitle").text(formatPeekTitle(peekDate));
    $("#dayPeekList").empty();

    if (!dayTransactions.length) {
        $("#dayPeekEmpty").show();
        return;
    }

    $("#dayPeekEmpty").hide();
    $("#dayPeekList").append(`<ul>${dayTransactions.map(buildPeekItem).join("")}</ul>`);
}

export function setSideTab(tabName) {
    const name = tabName === "peek" ? "peek" : "input";

    $(".btn_side_tab").removeClass("is_active").attr("aria-selected", "false");
    $(`.btn_side_tab[data-side-tab="${name}"]`).addClass("is_active").attr("aria-selected", "true");
    $("#dayPeek, #inputFormPanel").removeClass("is_side_active");

    if (name === "peek") {
        $("#dayPeek").addClass("is_side_active");
        renderDayPeek(selectedCalendarDate || $("#date").val() || getTodayYMD());
        return;
    }

    $("#inputFormPanel").addClass("is_side_active");
}

export function selectCalendarDate(dateStr) {
    if (!dateStr) return;

    selectedCalendarDate = dateStr;
    $("#date").val(dateStr);
    syncDateChip();
    $(".cell_day").removeClass("is_selected");
    $(`.cell_day[data-date="${dateStr}"]`).addClass("is_selected");
    renderDayPeek(dateStr);

    if (!isCompactLayout()) setSideTab("input");
}

function renderTransactionList() {
    const list = $("#transactionList");
    if (!list.length) return;

    list.empty();
    const transactions = getHistoryTransactions();

    if (!transactions.length) {
        $("#historyEmpty").show();
        return;
    }

    $("#historyEmpty").hide();

    const byDate = {};
    transactions.forEach(t => {
        if (!byDate[t.date]) byDate[t.date] = [];
        byDate[t.date].push(t);
    });

    Object.keys(byDate)
        .sort((a, b) => b.localeCompare(a))
        .forEach(dateStr => {
            const dayItems = byDate[dateStr].sort((a, b) =>
                (b.createdAt || "").localeCompare(a.createdAt || "")
            );

            list.append(`
                <section class="group_history_day">
                    <div class="header_history_day">
                        <h4 class="tit_history_day">${formatHistoryDateHeader(dateStr)}</h4>
                        <span class="txt_history_day_summary">${formatDaySummary(dayItems)}</span>
                    </div>
                    <ul class="list_history_day">
                        ${dayItems.map(t => buildHistoryListItem(t)).join("")}
                    </ul>
                </section>
            `);
        });
}

function refreshUI() {
    updateSummary();
    renderCalendar();
    renderHistoryPanel();
    renderDayPeek(selectedCalendarDate);
}

function isCompactLayout() {
    return window.matchMedia("(max-width: 1023px)").matches;
}

function syncDateChip() {
    $("#dateChipText").text(formatDateChip($("#date").val()));
}

function getAmountDigits() {
    return String($("#amount").val() || "").replace(/[^\d]/g, "");
}

function syncAmountDisplay() {
    const raw = getAmountDigits();
    const display = raw ? Number(raw).toLocaleString("ko-KR") : "";
    const active = document.activeElement === $("#amount").get(0);

    $("#amount").val(active ? raw : display);
    $("#amountHero").toggleClass("is_empty", !raw);
}

export function setAmountDigits(value) {
    const raw = String(value || "").replace(/[^\d]/g, "");
    $("#amount").val(raw);
    $("#amountHero").removeClass("is_error");
    syncAmountDisplay();
}

export function appendAmountDigit(digit) {
    const raw = getAmountDigits();
    if (raw.length >= 12) return;
    if (!raw && digit === "0") {
        $("#amount").val("");
        syncAmountDisplay();
        return;
    }

    $("#amount").val(raw + digit);
    $("#amountHero").removeClass("is_error");
    syncAmountDisplay();
}

export function removeAmountDigit() {
    const raw = getAmountDigits();
    $("#amount").val(raw.slice(0, -1));
    $("#amountHero").removeClass("is_error");
    syncAmountDisplay();
}

export function openInputModal() {
    syncDateChip();
    syncAmountDisplay();

    if (!isCompactLayout()) {
        setSideTab("input");
        return;
    }

    $("#inputModalOverlay, #inputFormPanel").addClass("is_open");
}

export function openNewInputModal() {
    resetInputForm();
    const dateStr = selectedCalendarDate || getTodayYMD();
    $("#date").val(dateStr);
    syncDateChip();
    openInputModal();
}

export function openInputForDate(dateStr) {
    if (!dateStr) return;

    selectCalendarDate(dateStr);
    resetInputForm();
    $("#date").val(dateStr);
    syncDateChip();
    openInputModal();
}

export function closeInputModal() {
    $("#inputModalOverlay, #inputFormPanel").removeClass("is_open");
}

export function openDayPeekModal() {
    renderDayPeek(selectedCalendarDate || $("#date").val() || getTodayYMD());

    if (!isCompactLayout()) {
        setSideTab("peek");
        return;
    }

    $("#dayPeekOverlay, #dayPeek").addClass("is_open");
}

export function closeDayPeekModal() {
    $("#dayPeekOverlay, #dayPeek").removeClass("is_open");
}

function resetInputForm() {
    editingId = null;
    $("#saveBtn").text("저장하기");
    $(".tit_input").text("내역 추가");
    $("#amount").val("");
    $("#memo").val("");
    $("#type").val("expense");
    $(".btn_type").removeClass("is_active");
    $('.btn_type[data-type="expense"]').addClass("is_active");
    loadCategories();
    syncAmountDisplay();
    clearFormErrors();
}

export function startEditTransaction(id) {
    const transaction = getTransactionById(id);
    if (!transaction) return;

    editingId = id;
    $(".btn_type").removeClass("is_active");
    $(`.btn_type[data-type="${transaction.type}"]`).addClass("is_active");
    $("#type").val(transaction.type);
    loadCategories(transaction.category);
    $("#date").val(transaction.date);
    $("#amount").val(String(transaction.amount));
    $("#memo").val(transaction.memo || "");
    $("#saveBtn").text("수정하기");
    $(".tit_input").text("내역 수정");
    syncDateChip();
    syncAmountDisplay();
    clearFormErrors();
    openInputModal();
}

async function deleteTransaction(id) {
    const user = auth.currentUser;
    if (!user || !id) return;
    if (!confirm("이 내역을 삭제하시겠습니까?")) return;

    await deleteDoc(doc(db, "users", user.uid, "transactions", id));
    if (editingId === id) resetInputForm();
    await loadTransactions();
}

export function initApp() {
    const today = getTodayYMD();
    selectedCalendarDate = today;
    updateMonthDisplay();
    $("#date").val(today);
    $("#type").val("expense");
    $(".btn_type").removeClass("is_active");
    $('.btn_type[data-type="expense"]').addClass("is_active");
    loadCategories();
    initHistoryFilter();
    syncDateChip();
    syncAmountDisplay();
    renderDayPeek(today);
}

function clearFormErrors() {
    $("#amountHero, #dateChip, #categoryChips").removeClass("is_error");
    $("#formErrorMsg").hide();
}

function validateForm() {
    clearFormErrors();

    const date = $("#date").val();
    const category = $("#category").val();
    const amountVal = getAmountDigits();
    let hasError = false;

    if (!date) {
        $("#dateChip").addClass("is_error");
        hasError = true;
    }

    if (!category) {
        $("#categoryChips").addClass("is_error");
        hasError = true;
    }

    if (amountVal === "" || amountVal == null) {
        $("#amountHero").addClass("is_error");
        hasError = true;
    }

    if (hasError) {
        $("#formErrorMsg").show();
        return false;
    }

    return true;
}

$(document).ready(function () {
    $("#type").on("change", function () {
        loadCategories();
    });
    $("#saveBtn").on("click", saveTransaction);
    $("#date").on("change", function () {
        selectedCalendarDate = $(this).val() || selectedCalendarDate;
        syncDateChip();
    });
    $(document).on("click", ".btn_transaction_edit", function (event) {
        event.stopPropagation();
        startEditTransaction($(this).data("id"));
    });
    $(document).on("click", ".btn_transaction_delete", function (event) {
        event.stopPropagation();
        deleteTransaction($(this).data("id"));
    });
    $("#historyStartDate, #historyEndDate").on("change", function () {
        $(this).removeClass("is_error");
        applyHistoryFilter();
    });
    $(".btn_history_type").on("click", function () {
        switchHistoryType($(this).data("history-type"));
    });
    $("#historyCategory").on("change", function () {
        syncHistoryFiltersFromUI();
        if (historyFilterStart && historyFilterEnd) renderHistoryPanel();
    });
    $("#todayBtn").on("click", goToToday);
    initApp();
});

async function saveTransaction() {
    const user = auth.currentUser;
    if (!user) return;
    if (!validateForm()) return;

    const amount = Number(getAmountDigits());
    if (!amount || amount <= 0) {
        $("#amountHero").addClass("is_error");
        $("#formErrorMsg").show();
        return;
    }

    const payload = {
        type: $("#type").val(),
        category: $("#category").val(),
        amount,
        memo: $("#memo").val(),
        date: $("#date").val()
    };

    if (editingId) {
        await updateDoc(doc(db, "users", user.uid, "transactions", editingId), payload);
    } else {
        await addDoc(collection(db, "users", user.uid, "transactions"), {
            ...payload,
            createdAt: new Date().toISOString()
        });
    }

    selectedCalendarDate = payload.date;
    await loadTransactions();
    resetInputForm();
    $("#date").val(selectedCalendarDate);
    syncDateChip();
    closeInputModal();
}

export async function loadTransactions() {
    const user = auth.currentUser;
    if (!user) return;

    const q = query(
        collection(db, "users", user.uid, "transactions"),
        orderBy("date", "desc")
    );
    const snap = await getDocs(q);

    allTransactions = snap.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
    }));
    refreshUI();
}

if ("serviceWorker" in navigator) {
    window.addEventListener("load", async () => {
        try {
            await navigator.serviceWorker.register("./service-worker.js");
        } catch (err) {
            console.error("Service Worker 등록 실패", err);
        }
    });
}
