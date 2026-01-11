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

	where_clause = " AND ".join(conditions)

	columns = [
		{"fieldname": "status", "label": "Status", "fieldtype": "Data", "width": 160},
		{"fieldname": "scorecards", "label": "Scorecards", "fieldtype": "Int", "width": 110},
		{"fieldname": "average_score", "label": "Avg Score", "fieldtype": "Float", "width": 110}
	]

	data = frappe.db.sql(f"""
		SELECT status,
			COUNT(*) AS scorecards,
			AVG(overall_score) AS average_score
		FROM `tabPerformance Scorecard`
		WHERE {where_clause}
		GROUP BY status
		ORDER BY scorecards DESC
	""", values, as_dict=1)

	return columns, data
