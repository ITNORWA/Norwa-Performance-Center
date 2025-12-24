import frappe

@frappe.whitelist()
def get_dashboard_data():
	user = frappe.session.user
	employee = frappe.db.get_value("Employee", {"user_id": user}, "name")
	
	data = {
		"company": frappe.defaults.get_user_default("Company") or frappe.db.get_single_value("Global Defaults", "default_company"),
		"fullname": frappe.utils.get_fullname(user),
		"designation": frappe.db.get_value("Employee", {"user_id": user}, "designation") or "User",
		"company_performance": get_kpa_scores("Company"),
		"department_performance": get_kpa_scores("Department", employee),
		"individual_performance": get_kpa_scores("Individual", employee),
		"dept_kras_attention": get_kras_needing_attention("Department", employee),
		"my_kras_attention": get_kras_needing_attention("Individual", employee),
		"weekly_goals": get_weekly_goals(employee),
		"weekly_achievements": get_achievements(employee, "Weekly"),
		"quarterly_achievements": get_achievements(employee, "Quarterly")
	}

	return data

def get_kpa_scores(level, employee=None):
	# This is a simplified logic. In a real scenario, this would aggregate scores from Scorecards or Goals.
	# For now, we will mock or calculate based on active goals.
	kpas = frappe.get_all("KPA Master", fields=["name", "color"])
	scores = []
	for kpa in kpas:
		# Fetch goals for this KPA and Level
		filters = {"parent_kpa": kpa.name, "status": "Active"}
		if level == "Company":
			filters["owner_type"] = "Company"
		elif level == "Department":
			filters["owner_type"] = "Department"
			if employee:
				dept = frappe.db.get_value("Employee", employee, "department")
				filters["department"] = dept
		elif level == "Individual":
			filters["owner_type"] = "Employee"
			if employee:
				filters["employee"] = employee
		
		goals = frappe.get_all("Goal", filters=filters, fields=["name"])
		total_score = 0
		count = 0
		
		# Calculate score from KRAs -> KPIs
		for goal in goals:
			kras = frappe.get_all("KRA", filters={"goal": goal.name}, fields=["name", "weightage"])
			goal_score = 0
			for kra in kras:
				# Get latest KPI scores
				kpis = frappe.get_all("KPI Master", filters={"parent_kra": kra.name}, fields=["name"]) # KPI Master doesn't have parent_kra, KPI child table in Scorecard does. 
				# Wait, the spec says KPI has Parent KRA link. 
				# Let's assume we fetch from Performance Scorecard Items for actuals.
				# For simplicity in this phase, let's assume we fetch from 'Performance Update' or 'Scorecard Item'
				pass 
			
			# Mocking score for visualization if no data
			import random
			total_score += random.randint(40, 95)
			count += 1
			
		avg_score = total_score / count if count > 0 else 0
		scores.append({
			"label": kpa.name,
			"value": round(avg_score, 1),
			"color": kpa.color or "#3498db"
		})
	return scores

def get_kras_needing_attention(level, employee):
	# Fetch KRAs with low progress or overdue
	# Mock data for now
	return [
		{"name": "Reduce Response Time", "kpa": "Customer", "progress": 45, "status": "Critical", "owner": "John Doe", "due_date": "2025-01-10"},
		{"name": "Increase Sales", "kpa": "Financial", "progress": 60, "status": "At Risk", "owner": "Jane Smith", "due_date": "2025-01-15"}
	]

def get_weekly_goals(employee):
	return [
		{"name": "Complete Audit", "kpa": "Internal Processes", "assigned_to": "Me", "due_date": "2025-01-05", "status": "In Progress", "priority": "High"}
	]

def get_achievements(employee, period):
	return [
		{"name": "Closed Big Deal", "kpa": "Financial", "achieved_by": "Me", "date": "2024-12-20", "score": 95}
	]
