frappe.query_reports["Department Scorecard Summary"] = {
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
		}
	]
};
