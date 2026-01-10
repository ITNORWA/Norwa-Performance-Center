import frappe

def execute(filters=None):
	columns = [
		{"fieldname": "employee", "label": "Employee", "fieldtype": "Link", "options": "Employee", "width": 150},
		{"fieldname": "department", "label": "Department", "fieldtype": "Link", "options": "Department", "width": 150},
		{"fieldname": "overall_score", "label": "Overall Score", "fieldtype": "Float", "width": 100},
		{"fieldname": "status", "label": "Status", "fieldtype": "Data", "width": 100}
	]
	
	data = []
	
	conditions = ""
	if filters.get("period_start"):
		conditions += f" AND start_date >= '{filters.get('period_start')}'"
	if filters.get("period_end"):
		conditions += f" AND end_date <= '{filters.get('period_end')}'"
		
	scorecards = frappe.db.sql(f"""
		SELECT employee, department, overall_score, status
		FROM `tabPerformance Scorecard`
		WHERE docstatus < 2 {conditions}
	""", as_dict=1)
	
	data = scorecards
	
	return columns, data
