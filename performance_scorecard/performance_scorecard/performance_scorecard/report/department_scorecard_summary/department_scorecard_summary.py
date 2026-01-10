import frappe


def execute(filters=None):
	filters = filters or {}
	conditions = ["docstatus < 2"]
	values = {}

	if filters.get("period_start"):
		conditions.append("start_date >= %(period_start)s")
		values["period_start"] = filters.get("period_start")

	if filters.get("period_end"):
		conditions.append("end_date <= %(period_end)s")
		values["period_end"] = filters.get("period_end")

	if filters.get("department"):
		conditions.append("department = %(department)s")
		values["department"] = filters.get("department")

	where_clause = " AND ".join(conditions)

	columns = [
		{"fieldname": "department", "label": "Department", "fieldtype": "Link", "options": "Department", "width": 180},
		{"fieldname": "scorecards", "label": "Scorecards", "fieldtype": "Int", "width": 110},
		{"fieldname": "average_score", "label": "Avg Score", "fieldtype": "Float", "width": 110},
		{"fieldname": "best_score", "label": "Best Score", "fieldtype": "Float", "width": 110},
		{"fieldname": "worst_score", "label": "Worst Score", "fieldtype": "Float", "width": 110}
	]

	data = frappe.db.sql(f"""
		SELECT department,
			COUNT(*) AS scorecards,
			AVG(overall_score) AS average_score,
			MAX(overall_score) AS best_score,
			MIN(overall_score) AS worst_score
		FROM `tabPerformance Scorecard`
		WHERE {where_clause}
		GROUP BY department
		ORDER BY average_score DESC
	""", values, as_dict=1)

	return columns, data
