(function () {
	function apply_lock() {
		if (!window.frappe || !frappe.get_route) {
			return;
		}

		if (localStorage.getItem("npc_nav_lock") !== "1") {
			return;
		}

		document.body.classList.add("npc-locked");

		var route = frappe.get_route() || [];
		if (route[0] === "desk" || route[0] === "home") {
			frappe.set_route("performance-dashboard");
		}
	}

	if (window.frappe && frappe.router) {
		frappe.router.on("change", apply_lock);
	}

	if (window.frappe && frappe.ready) {
		frappe.ready(apply_lock);
	} else {
		setTimeout(apply_lock, 0);
	}
})();
