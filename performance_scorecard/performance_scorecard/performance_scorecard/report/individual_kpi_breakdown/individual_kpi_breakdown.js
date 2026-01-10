frappe.query_reports["Individual KPI Breakdown"] = {
	"filters": [
		{
			"fieldname": "period_start",
			"label": __("Period Start"),
			"fieldtype": "Date"
		},
		{
			"fieldname": "period_end",
			"label": __("Period End"),
			"fieldtype": "Date"
		},
		{
			"fieldname": "department",
			"label": __("Department"),
			"fieldtype": "Link",
			"options": "Department"
		},
		{
			"fieldname": "employee",
			"label": __("Employee"),
			"fieldtype": "Link",
			"options": "Employee",
			"get_query": () => {
				const dept = frappe.query_report.get_filter_value("department");
				if (!dept) {
					return {};
				}
				return { filters: { department: dept } };
			}
		}
	]
};
