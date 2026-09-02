$(function () {
	var $tabs = $(".btn_tab");
	var $panels = $(".panel_tab");
	var $typeButtons = $(".btn_type");

	$tabs.on("click", function () {
		var tabName = $(this).data("tab");

		$tabs.removeClass("is_active");
		$tabs.filter("[data-tab='" + tabName + "']").addClass("is_active");
		$panels.removeClass("is_active");
		$panels.filter("[data-panel='" + tabName + "']").addClass("is_active");

		import("./app.js").then(function (app) {
			app.closeDayPeekModal();
		});
	});

	$typeButtons.on("click", function () {
		$typeButtons.removeClass("is_active");
		$(this).addClass("is_active");
		$("#type").val($(this).data("type")).trigger("change");
	});

	$(document).on("click", ".cell_day:not(.cell_day_empty)", function () {
		var selectedDate = $(this).data("date");
		if (!selectedDate) return;

		import("./app.js").then(function (app) {
			app.selectCalendarDate(selectedDate);
		});
	});

	$(document).on("click", ".btn_side_tab", function () {
		var tabName = $(this).data("side-tab");
		import("./app.js").then(function (app) {
			app.setSideTab(tabName);
		});
	});

	$(document).on("click", "#dayPeekAddBtn", function () {
		import("./app.js").then(function (app) {
			var selectedDate = $("#date").val();
			if (selectedDate) app.openInputForDate(selectedDate);
			else app.openNewInputModal();
		});
	});

	$(document).on("click", ".btn_category_chip", function () {
		var category = $(this).data("category");
		import("./app.js").then(function (app) {
			app.selectCategory(category);
		});
	});

	$(document).on("click", "[data-category-nav]", function () {
		var delta = $(this).data("category-nav") === "next" ? 1 : -1;
		import("./app.js").then(function (app) {
			app.shiftCategoryPage(delta);
		});
	});

	$("#amount").on("input", function () {
		var value = $(this).val();
		import("./app.js").then(function (app) {
			app.setAmountDigits(value);
		});
	});

	$("#amount").on("focus blur", function () {
		var value = $(this).val();
		import("./app.js").then(function (app) {
			app.setAmountDigits(value);
		});
	});

	$(document).on("click", "#dayViewBtn", function () {
		import("./app.js").then(function (app) {
			app.openDayPeekModal();
		});
	});

	$(document).on("click", "#dayPeekOverlay, #dayPeekClose", function () {
		import("./app.js").then(function (app) {
			app.closeDayPeekModal();
		});
	});

	$(document).on("click", ".btn_keypad", function () {
		var key = $(this).data("key");
		if (key === "" || key == null) return;

		import("./app.js").then(function (app) {
			if (key === "back") app.removeAmountDigit();
			else app.appendAmountDigit(String(key));
		});
	});

	$(document).on("click", ".btn_period", function () {
		var period = $(this).data("period");
		import("./app.js").then(function (app) {
			app.applyHistoryPeriod(period);
		});
	});

	$("#historyFilterToggle").on("click", function () {
		$("#historyFilterPanel").toggleClass("is_open");
	});

	$("#searchInput").on("input", function () {
		var value = $(this).val();
		import("./app.js").then(function (app) {
			app.setHistorySearch(value);
		});
	});

	$(document).on("click", "[data-nav]", function () {
		var direction = $(this).data("nav") === "next" ? 1 : -1;
		import("./app.js").then(function (app) {
			app.changeMonth(direction);
		});
	});

	$(".form_input").on("submit", function (event) {
		event.preventDefault();
		$("#saveBtn").trigger("click");
	});

	$("#openInputBtn").on("click", function () {
		import("./app.js").then(function (app) {
			app.openNewInputModal();
		});
	});

	$("#inputModalClose, #inputModalOverlay").on("click", function () {
		import("./app.js").then(function (app) {
			app.closeInputModal();
		});
	});
});
