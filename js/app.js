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

/* ---------------- 카테고리 ---------------- */

const incomeCategories = ["급여", "용돈", "부가수입", "기타"];
const expenseCategories = ["식비", "피어스", "개인", "음료(커피)", "다이소", "경조사", "고정비", "기타"];

let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth() + 1;
let allTransactions = [];
let editingId = null;
let currentDayModalDate = null;
let historyFilterStart = "";
let historyFilterEnd = "";
let historyFilterType = "all";
let historyFilterCategory = "";

const isRichUI = () => $("#calendarBody").length > 0;

const MAN_UNIT = 10000;
const EOK_UNIT = 100000000;

function buildAmountDisplay(abs, html = false) {
    const amount = Math.abs(Math.round(Number(abs) || 0));

    if (amount < MAN_UNIT) {
        const value = amount.toLocaleString("ko-KR");
        return html ? `${value}<mark>원</mark>` : `${value}원`;
    }

    const segments = [];
    let remaining = amount;

    if (remaining >= EOK_UNIT) {
        const eok = Math.floor(remaining / EOK_UNIT);
        segments.push({ value: eok.toLocaleString("ko-KR"), unit: "억" });
        remaining %= EOK_UNIT;
    }

    if (remaining >= MAN_UNIT) {
        const man = Math.floor(remaining / MAN_UNIT);
        segments.push({ value: man.toLocaleString("ko-KR"), unit: "만" });
        remaining %= MAN_UNIT;
    }

    if (remaining > 0) {
        segments.push({ value: remaining.toLocaleString("ko-KR"), unit: "원" });
    }

    return segments.map((segment, index) => {
        const isLast = index === segments.length - 1;
        const unit = isLast && html ? `<mark>${segment.unit}</mark>` : segment.unit;
        return `${segment.value}${unit}`;
    }).join(" ");
}

function formatAmount(amount) {
    return buildAmountDisplay(amount, false);
}

function formatAmountHtml(amount) {
    return buildAmountDisplay(amount, true);
}

function formatSignedAmount(amount) {
    const num = Number(amount) || 0;
    const sign = num > 0 ? "+" : num < 0 ? "-" : "";
    return `${sign}${buildAmountDisplay(Math.abs(num), false)}`;
}

function formatSignedAmountHtml(amount) {
    const num = Number(amount) || 0;
    const sign = num > 0 ? "+" : num < 0 ? "-" : "";
    return `${sign}${buildAmountDisplay(Math.abs(num), true)}`;
}

function getMonthPrefix() {
    return `${currentYear}-${String(currentMonth).padStart(2, "0")}`;
}

function formatDateYMD(year, month, day) {
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function getThisMonthRange() {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    const lastDay = new Date(year, month, 0).getDate();

    return {
        start: formatDateYMD(year, month, 1),
        end: formatDateYMD(year, month, lastDay)
    };
}

function initHistoryFilter() {
    const range = getThisMonthRange();

    historyFilterStart = range.start;
    historyFilterEnd = range.end;
    historyFilterType = "all";
    historyFilterCategory = "";
    $("#historyStartDate").val(range.start);
    $("#historyEndDate").val(range.end);
    $(".btn_history_type").removeClass("is_active");
    $('.btn_history_type[data-history-type="all"]').addClass("is_active");
    populateHistoryCategoryOptions();
    $("#historyFilterError").hide();
}

function populateHistoryCategoryOptions() {
    const $select = $("#historyCategory");

    if (!$select.length) return;

    if (historyFilterType === "all") {
        historyFilterCategory = "";
        $select.empty();
        $select.append('<option value="">전체 카테고리</option>');
        $select.val("");
        $select.prop("disabled", true);
        return;
    }

    const list = historyFilterType === "income"
        ? incomeCategories
        : expenseCategories;

    $select.prop("disabled", false);
    $select.empty();
    $select.append('<option value="">전체 카테고리</option>');

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

    if (historyFilterType === "all") {
        historyFilterCategory = "";
    } else {
        historyFilterCategory = $("#historyCategory").val() || "";
    }
}

function getHistoryPeriodTransactions() {
    if (!historyFilterStart || !historyFilterEnd) {
        return getMonthTransactions();
    }

    return allTransactions.filter(t =>
        t.date && t.date >= historyFilterStart && t.date <= historyFilterEnd
    );
}

function getHistoryTransactions() {
    return getHistoryPeriodTransactions().filter(t => {
        if (historyFilterType !== "all" && t.type !== historyFilterType) {
            return false;
        }

        if (historyFilterCategory && t.category !== historyFilterCategory) {
            return false;
        }

        return true;
    });
}

function formatHistoryDateHeader(dateStr) {
    const weekdayNames = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];
    const [year, month, day] = dateStr.split("-").map(Number);
    const weekday = weekdayNames[new Date(year, month - 1, day).getDay()];

    return `${year}년 ${month}월 ${day}일 ${weekday}`;
}

function formatDaySummary(transactions) {
    let income = 0;
    let expense = 0;

    transactions.forEach(t => {
        if (t.type === "income") income += t.amount;
        else expense += t.amount;
    });

    const parts = [];

    if (income) parts.push(`+${formatAmount(income)}`);
    if (expense) parts.push(`-${formatAmount(expense)}`);

    return parts.join(" ");
}

function buildHistoryListItem(t) {
    const sign = t.type === "income" ? "+" : "-";
    const typeClass = t.type === "income" ? "is_income" : "is_expense";
    const dotClass = t.type === "income" ? "dot_history_income" : "dot_history_expense";
    const memo = t.memo ? `<span class="txt_history_memo">${t.memo}</span>` : "";
    const actionsHtml = t.id
        ? `<div class="area_transaction_actions">
                <button type="button" class="btn_transaction btn_transaction_edit" data-id="${t.id}">수정</button>
                <button type="button" class="btn_transaction btn_transaction_delete" data-id="${t.id}">삭제</button>
           </div>`
        : "";

    return `
        <li class="item_history" data-id="${t.id || ""}">
            <div class="box_history_item_left">
                <span class="dot_history ${dotClass}" aria-hidden="true"></span>
                <div class="box_history_item_text">
                    <span class="txt_history_category">${t.category}</span>
                    ${memo}
                </div>
            </div>
            <div class="area_history_item_right">
                <span class="txt_history_amount ${typeClass}">${sign}${formatAmount(t.amount)}</span>
                ${actionsHtml}
            </div>
        </li>
    `;
}

function updateHistorySummary() {
    if (!$("#historySummaryIncome").length) return;

    let income = 0;
    let expense = 0;

    getHistoryTransactions().forEach(t => {
        if (t.type === "income") income += t.amount;
        else expense += t.amount;
    });

    const total = income - expense;

    $("#historySummaryIncome").html(formatAmountHtml(income));
    $("#historySummaryExpense").html(formatAmountHtml(expense));
    $("#historySummaryTotal").html(formatSignedAmountHtml(total));
}

function renderHistoryPanel() {
    updateHistorySummary();
    renderTransactionList();
}

function applyHistoryFilter() {
    const start = $("#historyStartDate").val();
    const end = $("#historyEndDate").val();

    if (!start || !end) {
        if (!start) {
            $("#historyStartDate").addClass("is_error");
        }

        if (!end) {
            $("#historyEndDate").addClass("is_error");
        }

        return;
    }

    $("#historyStartDate, #historyEndDate").removeClass("is_error");

    if (start > end) {
        $("#historyFilterError").show();
        return;
    }

    historyFilterStart = start;
    historyFilterEnd = end;
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

    if (historyFilterStart && historyFilterEnd) {
        renderHistoryPanel();
    }
}

function getTransactionById(id) {
    return allTransactions.find(t => t.id === id);
}

export function loadCategories(selectedCategory) {
    const type = $("#type").val();

    $("#category").empty();

    const list = type === "income"
        ? incomeCategories
        : expenseCategories;

    list.forEach(c => {
        $("#category").append(`<option value="${c}">${c}</option>`);
    });

    if (selectedCategory && list.includes(selectedCategory)) {
        $("#category").val(selectedCategory);
    }
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
    refreshUI();
    $("#date").val(today.toISOString().split("T")[0]);
}

function updateMonthDisplay() {
    const label = `${currentYear}년 ${currentMonth}월`;

    $(".txt_month").text(label);
    $(".caption_calendar").text(`${currentYear}년 ${currentMonth}월 가계부 달력`);
}

function getMonthTransactions() {
    const prefix = getMonthPrefix();

    return allTransactions.filter(t => t.date && t.date.startsWith(prefix));
}

function updateSummary() {
    if (!isRichUI()) return;

    let income = 0;
    let expense = 0;

    getMonthTransactions().forEach(t => {
        if (t.type === "income") income += t.amount;
        else expense += t.amount;
    });

    const total = income - expense;

    $(".txt_amount_income").html(formatAmountHtml(income));
    $(".txt_amount_expense").html(formatAmountHtml(expense));
    $(".txt_amount_total").html(formatSignedAmountHtml(total));
}

function renderCalendar() {
    const grid = $("#calendarBody");
    if (!grid.length) return;

    const firstDay = new Date(currentYear, currentMonth - 1, 1);
    const lastDay = new Date(currentYear, currentMonth, 0);
    const startPad = firstDay.getDay();
    const daysInMonth = lastDay.getDate();
    const selectedDate = $("#date").val();

    const byDate = {};

    getMonthTransactions().forEach(t => {
        if (!byDate[t.date]) {
            byDate[t.date] = { income: 0, expense: 0, incomeCount: 0, expenseCount: 0 };
        }

        if (t.type === "income") {
            byDate[t.date].income += t.amount;
            byDate[t.date].incomeCount++;
        } else {
            byDate[t.date].expense += t.amount;
            byDate[t.date].expenseCount++;
        }
    });

    let html = "";
    let cellCount = 0;

    for (let i = 0; i < startPad; i++) {
        html += '<div class="cell_day cell_day_empty" role="gridcell" aria-hidden="true"></div>';
        cellCount++;
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${currentYear}-${String(currentMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const data = byDate[dateStr];
        const selected = dateStr === selectedDate ? " is_selected" : "";

        html += `<div class="cell_day${selected}" data-date="${dateStr}" role="gridcell">`;
        html += `<span class="txt_day">${day}</span>`;

        if (data) {
            const total = data.income - data.expense;

            html += '<ul class="list_amount">';

            if (data.income) {
                html += `<li class="item_amount item_amount_income">+${formatAmount(data.income)}</li>`;
            }

            if (data.expense) {
                html += `<li class="item_amount item_amount_expense">-${formatAmount(data.expense)}</li>`;
            }

            html += `<li class="item_amount item_amount_total">${formatSignedAmount(total)}</li>`;
            html += "</ul>";

            html += '<ul class="list_count">';

            if (data.incomeCount) {
                html += `<li class="item_count item_count_income">${data.incomeCount}건</li>`;
            }

            if (data.expenseCount) {
                html += `<li class="item_count item_count_expense">${data.expenseCount}건</li>`;
            }

            html += "</ul>";
        }

        html += "</div>";
        cellCount++;
    }

    while (cellCount % 7 !== 0) {
        html += '<div class="cell_day cell_day_empty" role="gridcell" aria-hidden="true"></div>';
        cellCount++;
    }

    const rowCount = Math.ceil(cellCount / 7);

    grid.html(html);
    grid.get(0).style.setProperty("--calendar-rows", rowCount);
}

function renderTransactionList() {
    const list = $("#transactionList");
    if (!list.length) return;

    list.empty();

    const transactions = getHistoryTransactions();

    if (isRichUI()) {
        if (!transactions.length) {
            $("#historyEmpty").show();
            return;
        }

        $("#historyEmpty").hide();

        const byDate = {};

        transactions.forEach(t => {
            if (!byDate[t.date]) {
                byDate[t.date] = [];
            }

            byDate[t.date].push(t);
        });

        Object.keys(byDate)
            .sort((a, b) => b.localeCompare(a))
            .forEach(dateStr => {
                const dayItems = byDate[dateStr].sort((a, b) =>
                    (b.createdAt || "").localeCompare(a.createdAt || "")
                );
                const itemsHtml = dayItems.map(t => buildHistoryListItem(t)).join("");

                list.append(`
                    <section class="group_history_day">
                        <div class="header_history_day">
                            <h4 class="tit_history_day">${formatHistoryDateHeader(dateStr)}</h4>
                            <span class="txt_history_day_summary">${formatDaySummary(dayItems)}</span>
                        </div>
                        <ul class="list_history_day">
                            ${itemsHtml}
                        </ul>
                    </section>
                `);
            });

        return;
    }

    allTransactions.forEach(t => {
        const sign = t.type === "income" ? "+" : "-";

        list.append(`
            <div>
                <div>${t.date}</div>
                <div>${t.category}</div>
                <div>${t.memo}</div>
                <div>${sign}${formatAmount(t.amount)}</div>
            </div>
            <hr>
        `);
    });
}

function refreshUI() {
    updateSummary();
    renderCalendar();
    renderHistoryPanel();
    refreshDayModalIfOpen();
}

function getTransactionsByDate(dateStr) {
    return allTransactions.filter(t => t.date === dateStr);
}

function buildTransactionItem(t, options = {}) {
    const sign = t.type === "income" ? "+" : "-";
    const typeClass = t.type === "income" ? "is_income" : "is_expense";
    const memo = t.memo ? `<span class="txt_transaction_memo">${t.memo}</span>` : "";
    const dateHtml = options.showDate
        ? `<span class="txt_transaction_date">${t.date}</span>`
        : "";
    const actionsHtml = options.showActions && t.id
        ? `<div class="area_transaction_actions">
                <button type="button" class="btn_transaction btn_transaction_edit" data-id="${t.id}">수정</button>
                <button type="button" class="btn_transaction btn_transaction_delete" data-id="${t.id}">삭제</button>
           </div>`
        : "";

    return `
        <article class="item_transaction" data-id="${t.id || ""}">
            <div class="box_transaction_info">
                ${dateHtml}
                <span class="txt_transaction_category">${t.category}</span>
                ${memo}
            </div>
            <div class="area_transaction_right">
                <span class="txt_transaction_amount ${typeClass}">${sign}${formatAmount(t.amount)}</span>
                ${actionsHtml}
            </div>
        </article>
    `;
}

function refreshDayModalIfOpen() {
    if (!currentDayModalDate || !$("#dayDetailModal").is(":visible")) return;

    renderDayModalContent(currentDayModalDate);
}

function renderDayModalContent(dateStr) {
    const dayTransactions = getTransactionsByDate(dateStr);
    let income = 0;
    let expense = 0;

    dayTransactions.forEach(t => {
        if (t.type === "income") income += t.amount;
        else expense += t.amount;
    });

    const total = income - expense;
    const [year, month, day] = dateStr.split("-");

    $("#dayModalTitle").text(`${year}년 ${Number(month)}월 ${Number(day)}일`);
    $("#dayModalIncome").html(formatAmountHtml(income));
    $("#dayModalExpense").html(formatAmountHtml(expense));
    $("#dayModalTotal").html(formatSignedAmountHtml(total));

    const list = $("#dayModalList");
    list.empty();

    if (!dayTransactions.length) {
        $("#dayModalEmpty").show();
    } else {
        $("#dayModalEmpty").hide();

        dayTransactions
            .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
            .forEach(t => {
                list.append(buildTransactionItem(t, { showActions: true }));
            });
    }
}

export function openDayDetailModal(dateStr) {
    if (!dateStr || !$("#dayDetailModal").length) return;

    currentDayModalDate = dateStr;
    renderDayModalContent(dateStr);

    $("#dayModalOverlay").show();
    $("#dayDetailModal").show();
}

export function closeDayDetailModal() {
    currentDayModalDate = null;
    $("#dayModalOverlay").hide();
    $("#dayDetailModal").hide();
}

function isCompactLayout() {
    return window.matchMedia("(max-width: 1200px)").matches;
}

export function openInputModal() {
    if (!isCompactLayout()) return;

    $("#inputModalOverlay, #inputFormPanel").addClass("is_open");
}

export function openNewInputModal() {
    resetInputForm();
    $("#date").val(new Date().toISOString().split("T")[0]);
    openInputModal();
}

export function closeInputModal() {
    $("#inputModalOverlay, #inputFormPanel").removeClass("is_open");
}

function resetInputForm() {
    editingId = null;
    $("#saveBtn").text("저장하기");
    $(".tit_input").text("내역 입력");
    $("#amount").val("");
    $("#memo").val("");
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

    closeDayDetailModal();
    clearFormErrors();
    openInputModal();
}

async function deleteTransaction(id) {
    const user = auth.currentUser;
    if (!user || !id) return;

    if (!confirm("이 내역을 삭제하시겠습니까?")) return;

    await deleteDoc(doc(db, "users", user.uid, "transactions", id));

    if (editingId === id) {
        resetInputForm();
    }

    await loadTransactions();
}

export function initApp() {
    updateMonthDisplay();
    $("#date").val(new Date().toISOString().split("T")[0]);
    loadCategories();
    initHistoryFilter();
}

function clearFormErrors() {
    $(".form_input .box_field").removeClass("is_error");
    $("#formErrorMsg").hide();
}

function validateForm() {
    clearFormErrors();

    const date = $("#date").val();
    const category = $("#category").val();
    const amountVal = $("#amount").val();
    let hasError = false;

    if (!date) {
        $("#date").closest(".box_field").addClass("is_error");
        hasError = true;
    }

    if (!category) {
        $("#category").closest(".box_field").addClass("is_error");
        hasError = true;
    }

    if (amountVal === "" || amountVal == null) {
        $("#amount").closest(".box_field").addClass("is_error");
        hasError = true;
    }

    if (hasError) {
        $("#formErrorMsg").show();
        return false;
    }

    return true;
}

/* ---------------- 초기 ---------------- */

$(document).ready(function () {
    $("#type").on("change", function () {
        loadCategories();
    });
    $("#saveBtn").on("click", saveTransaction);
    $("#dayModalClose, #dayModalOverlay").on("click", closeDayDetailModal);
    $("#date, #category, #amount").on("input change", function () {
        $(this).closest(".box_field").removeClass("is_error");

        if (!$(".form_input .box_field.is_error").length) {
            $("#formErrorMsg").hide();
        }
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

        if (historyFilterStart && historyFilterEnd) {
            renderHistoryPanel();
        }
    });
    $("#todayBtn").on("click", goToToday);

    initApp();
});

/* ---------------- 저장 ---------------- */

async function saveTransaction() {
    const user = auth.currentUser;
    if (!user) return;

    if (!validateForm()) return;

    const amount = Number($("#amount").val());
    if (!amount || amount <= 0) {
        $("#amount").closest(".box_field").addClass("is_error");
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
        await updateDoc(
            doc(db, "users", user.uid, "transactions", editingId),
            payload
        );
    } else {
        await addDoc(
            collection(db, "users", user.uid, "transactions"),
            {
                ...payload,
                createdAt: new Date().toISOString()
            }
        );
    }

    await loadTransactions();
    resetInputForm();
    closeInputModal();
}

/* ---------------- 조회 ---------------- */

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
            const reg = await navigator.serviceWorker.register("./service-worker.js");
            console.log("✅ Service Worker 등록 성공", reg);
        } catch (err) {
            console.error("❌ Service Worker 등록 실패", err);
        }
    });
}
