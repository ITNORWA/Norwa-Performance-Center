import frappe


def execute(filters=None):
	filters = filters or {}
	conditions = []
	values = {}

	department = filters.get("department")
	if department:
		conditions.append("g.department = %(department)s")
		values["department"] = department

	employee = filters.get("employee")
	if employee:
		conditions.append("g.employee = %(employee)s")
		values["employee"] = employee

	where_clause = ""
	if conditions:
		where_clause = "WHERE " + " AND ".join(conditions)

	query = f"""
		SELECT k.kra_name as kra,
			k.priority as priority,
			k.owner_type as owner_type,
			k.goal as goal,
			g.department as department,
			g.employee as employee
		FROM `tabKRA` k
		INNER JOIN `tabGoal` g ON g.name = k.goal
		{where_clause}
		ORDER BY FIELD(k.priority, 'High', 'Medium', 'Low')
	"""

	data = frappe.db.sql(query, values, as_dict=True)
	columns = [
		{"fieldname": "kra", "label": "KRA", "fieldtype": "Link", "options": "KRA", "width": 260},
		{"fieldname": "priority", "label": "Priority", "fieldtype": "Data", "width": 120},
		{"fieldname": "owner_type", "label": "Owner Type", "fieldtype": "Data", "width": 120},
		{"fieldname": "goal", "label": "Goal", "fieldtype": "Link", "options": "Goal", "width": 200},
		{"fieldname": "department", "label": "Department", "fieldtype": "Link", "options": "Department", "width": 160},
		{"fieldname": "employee", "label": "Employee", "fieldtype": "Link", "options": "Employee", "width": 160},
	]
	return columns, data
