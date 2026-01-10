import frappe


def execute(filters=None):
	filters = filters or {}
	conditions = [
		"sci.parenttype = 'Performance Scorecard'",
		"sc.docstatus < 2"
	]
	values = {}

	if filters.get("period_start"):
		conditions.append("sc.start_date >= %(period_start)s")
		values["period_start"] = filters.get("period_start")

	if filters.get("period_end"):
		conditions.append("sc.end_date <= %(period_end)s")
		values["period_end"] = filters.get("period_end")

	if filters.get("department"):
		conditions.append("sc.department = %(department)s")
		values["department"] = filters.get("department")

	if filters.get("employee"):
		conditions.append("sc.employee = %(employee)s")
		values["employee"] = filters.get("employee")

	where_clause = " AND ".join(conditions)

	columns = [
		{"fieldname": "employee", "label": "Employee", "fieldtype": "Link", "options": "Employee", "width": 150},
		{"fieldname": "department", "label": "Department", "fieldtype": "Link", "options": "Department", "width": 150},
		{"fieldname": "start_date", "label": "Period Start", "fieldtype": "Date", "width": 110},
		{"fieldname": "end_date", "label": "Period End", "fieldtype": "Date", "width": 110},
		{"fieldname": "kpa", "label": "KPA", "fieldtype": "Link", "options": "KPA Master", "width": 150},
		{"fieldname": "goal", "label": "Goal", "fieldtype": "Link", "options": "Goal", "width": 150},
		{"fieldname": "kra", "label": "KRA", "fieldtype": "Link", "options": "KRA", "width": 150},
		{"fieldname": "kpi", "label": "KPI", "fieldtype": "Link", "options": "KPI Master", "width": 150},
		{"fieldname": "weightage", "label": "Weightage", "fieldtype": "Percent", "width": 100},
		{"fieldname": "target", "label": "Target", "fieldtype": "Float", "width": 100},
		{"fieldname": "actual", "label": "Actual", "fieldtype": "Float", "width": 100},
		{"fieldname": "score", "label": "Score", "fieldtype": "Float", "width": 100}
	]

	data = frappe.db.sql(f"""
		SELECT
			sc.employee,
			sc.department,
			sc.start_date,
			sc.end_date,
			sci.kpa,
			sci.goal,
			sci.kra,
			sci.kpi,
			sci.weightage,
			sci.target,
			sci.actual,
			sci.score
		FROM `tabScorecard Item` sci
		INNER JOIN `tabPerformance Scorecard` sc
			ON sc.name = sci.parent
		WHERE {where_clause}
		ORDER BY sc.start_date DESC, sc.employee ASC
	""", values, as_dict=1)

	return columns, data
