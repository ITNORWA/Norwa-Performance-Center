import frappe


def execute(filters=None):
	filters = filters or {}
	conditions = []
	values = {}

	employee = filters.get("employee")
	if employee:
		conditions.append("wc.employee = %(employee)s")
		values["employee"] = employee

	week_start = filters.get("week_start")
	if week_start:
		conditions.append("wc.week_start >= %(week_start)s")
		values["week_start"] = week_start

	week_end = filters.get("week_end")
	if week_end:
		conditions.append("wc.week_end <= %(week_end)s")
		values["week_end"] = week_end

	where_clause = ""
	if conditions:
		where_clause = "WHERE " + " AND ".join(conditions)

	query = f"""
		SELECT wc.title as title,
			wc.employee as employee,
			wc.week_start as week_start,
			wc.week_end as week_end,
			wc.kpi as kpi,
			wc.status as progress
		FROM `tabWeekly Commitment` wc
		{where_clause}
		ORDER BY wc.week_start DESC
	"""

	data = frappe.db.sql(query, values, as_dict=True)
	columns = [
		{"fieldname": "title", "label": "Title", "fieldtype": "Data", "width": 240},
		{"fieldname": "employee", "label": "Employee", "fieldtype": "Link", "options": "Employee", "width": 160},
		{"fieldname": "week_start", "label": "Week Start", "fieldtype": "Date", "width": 120},
		{"fieldname": "week_end", "label": "Week End", "fieldtype": "Date", "width": 120},
		{"fieldname": "kpi", "label": "KPI", "fieldtype": "Link", "options": "KPI Master", "width": 200},
		{"fieldname": "progress", "label": "Progress", "fieldtype": "Data", "width": 100},
	]
	return columns, data
