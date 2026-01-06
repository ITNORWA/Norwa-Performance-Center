frappe.router.on("change", () => {
	if (frappe.get_route_str() === "performance-scorecard") {
		frappe.set_route("performance-dashboard");
	}
});
