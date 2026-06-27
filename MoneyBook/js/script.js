$(function () {
	var $tabs = $(".btn_tab");
	var $panels = $(".panel_tab");
	var $typeButtons = $(".btn_type");

	$tabs.on("click", function () {
		var tabName = $(this).data("tab");

		if (tabName === "register") {
			import("./app.js").then(function (app) {
				app.openNewInputModal();
			});
			return;
		}

		$tabs.not(".btn_tab_register").removeClass("is_active");
		$(this).addClass("is_active");

		$panels.removeClass("is_active");
		$panels.filter("[data-panel='" + tabName + "']").addClass("is_active");
	});

	$typeButtons.on("click", function () {
		$typeButtons.removeClass("is_active");
		$(this).addClass("is_active");

		$("#type").val($(this).data("type")).trigger("change");
	});

	$(document).on("click", ".cell_day:not(.cell_day_empty)", function () {
		$(".cell_day").removeClass("is_selected");
		$(this).addClass("is_selected");

		var selectedDate = $(this).data("date");
		if (selectedDate) {
			$("#date").val(selectedDate);

			import("./app.js").then(function (app) {
				app.openDayDetailModal(selectedDate);
			});
		}
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

	$("#amount").on("input", function () {
		var value = $(this).val().replace(/[^\d]/g, "");
		$(this).val(value);
	});

	$("#amount").on("paste", function (event) {
		event.preventDefault();
		var clipboard = event.originalEvent.clipboardData || window.clipboardData;
		var text = clipboard ? clipboard.getData("text") : "";
		$(this).val(text.replace(/[^\d]/g, ""));
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
