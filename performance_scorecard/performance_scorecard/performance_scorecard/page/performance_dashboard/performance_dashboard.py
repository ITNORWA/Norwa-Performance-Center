import frappe
from frappe.utils import add_days, add_months, nowdate


@frappe.whitelist()
def get_dashboard_data():
	user = frappe.session.user
	employee = frappe.db.get_value("Employee", {"user_id": user}, "name")
	department = frappe.db.get_value("Employee", employee, "department") if employee else None

	data = {
		"company": frappe.defaults.get_user_default("Company") or frappe.db.get_single_value("Global Defaults", "default_company"),
		"fullname": frappe.utils.get_fullname(user),
		"designation": frappe.db.get_value("Employee", {"user_id": user}, "designation") or "User",
		"objectives": [],
		"key_results": [],
		"needs_attention": [],
		"tasks": [],
		"kpis_needing_update": [],
		"recent_updates": [],
		"kra_progress": {
			"company": [],
			"department": [],
			"individual": []
		},
		"attention_company": [],
		"attention_department": [],
		"attention_individual": [],
		"weekly_top_kras": [],
		"quarterly_top_kras": []
	}

	if employee:
		# 1. My Key Objectives (Goals)
		data["objectives"] = frappe.db.get_list(
			"Goal",
			filters={"employee": employee, "status": "Active"},
			fields=["name", "goal_name", "status"]
		)

		# 2. My Key Results (KRAs)
		# Fetch KRAs linked to employee's goals
		goals = [g.name for g in data["objectives"]]
		if goals:
			data["key_results"] = frappe.db.get_list(
				"KRA",
				filters={"goal": ["in", goals]},
				fields=["name", "kra_name", "weightage"]
			)

		# 3. Needs Attention (Overdue/Underperforming KPIs)
		# Fetch latest scorecard items where score is low (e.g. < 50%)
		# For simplicity, let's fetch items from the latest active scorecard
		latest_scorecard = frappe.db.get_value(
			"Performance Scorecard",
			{"employee": employee, "docstatus": 0},
			"name",
			order_by="creation desc"
		)

		if latest_scorecard:
			scorecard_doc = frappe.get_doc("Performance Scorecard", latest_scorecard)
			for item in scorecard_doc.items:
				if item.score and item.score < 50:
					data["needs_attention"].append({
						"kpi": item.kpi,
						"score": item.score,
						"target": item.target,
						"actual": item.actual
					})

		# 4. My Tasks (Pending Updates)
		data["tasks"] = frappe.db.get_list(
			"Performance Update",
			filters={"owner": user, "status": "Draft"},
			fields=["name", "kpi", "status", "modified"]
		)

		# 5. KPIs Needing Update
		# TODO: Logic to check which KPIs haven't been updated in the current period
		# For now, return empty or mock

		# 6. Recent KPI Updates
		data["recent_updates"] = frappe.db.get_list(
			"Performance Update",
			filters={"owner": user},
			fields=["kpi", "actual_value", "modified"],
			order_by="modified desc",
			limit=5
		)

	data["kra_progress"]["company"] = _get_kra_progress_by_kpa(owner_type="Company")
	if department:
		data["kra_progress"]["department"] = _get_kra_progress_by_kpa(owner_type="Department", department=department)
	if employee:
		data["kra_progress"]["individual"] = _get_kra_progress_by_kpa(owner_type="Employee", employee=employee)

	data["attention_company"] = _get_kra_attention(owner_type="Company")
	if department:
		data["attention_department"] = _get_kra_attention(owner_type="Department", department=department)
	if employee:
		data["attention_individual"] = _get_kra_attention(owner_type="Employee", employee=employee)

	if department:
		data["weekly_top_kras"] = _get_top_kras_by_period(department, days=7, limit=5)
		data["quarterly_top_kras"] = _get_top_kras_by_period(department, months=3, limit=5)

	return data


@frappe.whitelist()
def get_dashboard_insights():
	user = frappe.session.user
	employee, department = _get_employee_profile(user)

	insights = {
		"meta": {
			"employee": employee,
			"department": department
		},
		"company": {},
		"department": {},
		"employee": {}
	}

	insights["company"] = {
		"kpa_scores": _get_company_kpa_scores(),
		"department_comparison": _get_department_comparison(),
		"trend": _get_score_trend(),
		"top_performers": _get_top_employees()
	}

	if department:
		insights["department"] = {
			"kpa_scores": _get_department_kpa_scores(department),
			"employee_distribution": _get_department_distribution(department),
			"goal_achievement_rate": _get_department_goal_achievement(department),
			"at_risk_kpis": _get_department_at_risk_kpis(department),
			"trend": _get_department_trend(department)
		}

	if employee:
		insights["employee"] = {
			"scorecard": _get_employee_scorecard(employee),
			"goal_progress": _get_employee_goal_progress(employee),
			"department_average": _get_department_average(department),
			"at_risk_kpis": _get_employee_at_risk_kpis(employee),
			"trend": _get_employee_trend(employee)
		}

	return insights


def _get_employee_profile(user):
	employee = frappe.db.get_value("Employee", {"user_id": user}, "name")
	department = None
	if employee:
		department = frappe.db.get_value("Employee", employee, "department")
	return employee, department


def _get_company_kpa_scores():
	kpa_field = _get_goal_kpa_field()
	if not kpa_field:
		return []

	rows = frappe.db.get_all(
		"Goal",
		filters={"owner_type": "Company"},
		fields=[kpa_field, "progress"]
	)

	grouped = {}
	for row in rows:
		kpa = row.get(kpa_field)
		if not kpa:
			continue
		grouped.setdefault(kpa, []).append(row.progress or 0)

	return [{"label": kpa, "value": sum(values) / len(values)} for kpa, values in grouped.items()]


def _get_department_comparison():
	rows = frappe.db.get_all(
		"Goal",
		filters={"owner_type": "Department"},
		fields=["department", "progress"]
	)

	grouped = {}
	for row in rows:
		dept = row.department
		if not dept:
			continue
		grouped.setdefault(dept, []).append(row.progress or 0)

	comparison = [
		{"label": dept, "value": sum(values) / len(values)}
		for dept, values in grouped.items()
	]
	return sorted(comparison, key=lambda x: x["value"], reverse=True)


def _get_score_trend():
	start = add_months(nowdate(), -5)
	query = """
		SELECT DATE_FORMAT(creation, '%%Y-%%m') as label,
			AVG(overall_score) as value
		FROM `tabPerformance Scorecard`
		WHERE creation >= %s
		GROUP BY DATE_FORMAT(creation, '%%Y-%%m')
		ORDER BY label ASC
	"""
	return frappe.db.sql(query, (start,), as_dict=True)


def _get_top_employees():
	rows = frappe.db.get_all(
		"Performance Scorecard",
		fields=["employee", "overall_score", "modified"],
		order_by="modified desc"
	)

	latest = {}
	for row in rows:
		if row.employee and row.employee not in latest:
			latest[row.employee] = row.overall_score or 0

	entries = [{"label": emp, "value": score} for emp, score in latest.items()]
	return sorted(entries, key=lambda x: x["value"], reverse=True)


def _get_department_kpa_scores(department):
	kpa_field = _get_goal_kpa_field()
	if not kpa_field:
		return []

	rows = frappe.db.get_all(
		"Goal",
		filters={"owner_type": "Department", "department": department},
		fields=[kpa_field, "progress"]
	)

	grouped = {}
	for row in rows:
		kpa = row.get(kpa_field)
		if not kpa:
			continue
		grouped.setdefault(kpa, []).append(row.progress or 0)

	return [{"label": kpa, "value": sum(values) / len(values)} for kpa, values in grouped.items()]


def _get_department_distribution(department):
	rows = frappe.db.get_all(
		"Performance Scorecard",
		filters={"department": department},
		fields=["overall_score"]
	)

	buckets = {"Top": 0, "Mid": 0, "Low": 0}
	for row in rows:
		score = row.overall_score or 0
		if score >= 80:
			buckets["Top"] += 1
		elif score >= 60:
			buckets["Mid"] += 1
		else:
			buckets["Low"] += 1

	return [{"label": key, "value": value} for key, value in buckets.items()]


def _get_department_goal_achievement(department):
	rows = frappe.db.get_all(
		"Goal",
		filters={"owner_type": "Department", "department": department},
		fields=["progress"]
	)
	if not rows:
		return 0
	return sum([row.progress or 0 for row in rows]) / len(rows)


def _get_department_at_risk_kpis(department):
	employees = frappe.db.get_all(
		"Employee",
		filters={"department": department},
		fields=["name"]
	)
	employee_names = [row.name for row in employees]
	if not employee_names:
		return []

	scorecards = frappe.db.get_all(
		"Performance Scorecard",
		filters={"employee": ["in", employee_names]},
		fields=["name"]
	)
	card_names = [row.name for row in scorecards]
	if not card_names:
		return []

	items = frappe.db.get_all(
		"Scorecard Item",
		filters={"parent": ["in", card_names], "score": ["<", 60]},
		fields=["kpi", "score"]
	)
	return [{"label": item.kpi, "value": item.score or 0} for item in items]


def _get_department_trend(department):
	start = add_months(nowdate(), -5)
	query = """
		SELECT DATE_FORMAT(creation, '%%Y-%%m') as label,
			AVG(overall_score) as value
		FROM `tabPerformance Scorecard`
		WHERE creation >= %s AND department = %s
		GROUP BY DATE_FORMAT(creation, '%%Y-%%m')
		ORDER BY label ASC
	"""
	return frappe.db.sql(query, (start, department), as_dict=True)


def _get_employee_scorecard(employee):
	name = frappe.db.get_value(
		"Performance Scorecard",
		{"employee": employee},
		"name",
		order_by="modified desc"
	)
	if not name:
		return {}
	doc = frappe.get_doc("Performance Scorecard", name)
	return {"overall_score": doc.overall_score or 0, "status": doc.status}


def _get_employee_goal_progress(employee):
	goals = frappe.db.get_all(
		"Goal",
		filters={"owner_type": "Employee", "employee": employee},
		fields=["goal_name", "progress"]
	)
	items = [{"goal_name": g.goal_name, "progress": g.progress or 0} for g in goals]
	average = sum([g["progress"] for g in items]) / len(items) if items else 0
	return {"items": items, "average": average}


def _get_department_average(department):
	if not department:
		return 0
	rows = frappe.db.get_all(
		"Performance Scorecard",
		filters={"department": department},
		fields=["overall_score"]
	)
	if not rows:
		return 0
	return sum([row.overall_score or 0 for row in rows]) / len(rows)


def _get_employee_at_risk_kpis(employee):
	scorecard = frappe.db.get_value(
		"Performance Scorecard",
		{"employee": employee},
		"name",
		order_by="modified desc"
	)
	if not scorecard:
		return []
	items = frappe.db.get_all(
		"Scorecard Item",
		filters={"parent": scorecard, "score": ["<", 60]},
		fields=["kpi", "score"]
	)
	return [{"label": item.kpi, "value": item.score or 0} for item in items]


def _get_employee_trend(employee):
	start = add_months(nowdate(), -5)
	query = """
		SELECT DATE_FORMAT(creation, '%%Y-%%m') as label,
			AVG(overall_score) as value
		FROM `tabPerformance Scorecard`
		WHERE creation >= %s AND employee = %s
		GROUP BY DATE_FORMAT(creation, '%%Y-%%m')
		ORDER BY label ASC
	"""
	return frappe.db.sql(query, (start, employee), as_dict=True)


def _get_goal_kpa_field():
	if frappe.db.has_column("Goal", "kpa"):
		return "kpa"
	if frappe.db.has_column("Goal", "parent_kpa"):
		return "parent_kpa"
	
	return None


def _get_kra_progress_by_kpa(owner_type, department=None, employee=None):
	kpa_field = _get_goal_kpa_field()
	if not kpa_field:
		return []

	conditions = ["g.owner_type = %s"]
	values = [owner_type]
	if department:
		conditions.append("g.department = %s")
		values.append(department)
	if employee:
		conditions.append("g.employee = %s")
		values.append(employee)

	query = f"""
		SELECT g.{kpa_field} as label,
			AVG(IFNULL(k.progress, 0)) as value
		FROM `tabKRA` k
		INNER JOIN `tabGoal` g ON g.name = k.goal
		WHERE {' AND '.join(conditions)}
		GROUP BY g.{kpa_field}
		ORDER BY g.{kpa_field} ASC
	"""
	rows = frappe.db.sql(query, values, as_dict=True)
	return [row for row in rows if row.get("label")]


def _get_kra_attention(owner_type, department=None, employee=None, limit=5):
	conditions = ["g.owner_type = %s"]
	values = [owner_type]
	if department:
		conditions.append("g.department = %s")
		values.append(department)
	if employee:
		conditions.append("g.employee = %s")
		values.append(employee)

	query = f"""
		SELECT k.kra_name as label,
			IFNULL(k.progress, 0) as value
		FROM `tabKRA` k
		INNER JOIN `tabGoal` g ON g.name = k.goal
		WHERE {' AND '.join(conditions)}
			AND IFNULL(k.progress, 0) < 60
		ORDER BY k.progress ASC
		LIMIT %s
	"""
	values.append(limit)
	return frappe.db.sql(query, values, as_dict=True)


def _get_top_kras_by_period(department, days=None, months=None, limit=5):
	if not department:
		return []

	if days:
		start = add_days(nowdate(), -days)
	elif months:
		start = add_months(nowdate(), -months)
	else:
		start = add_months(nowdate(), -3)

	query = """
		SELECT k.kra_name as label,
			IFNULL(k.progress, 0) as value
		FROM `tabKRA` k
		INNER JOIN `tabGoal` g ON g.name = k.goal
		WHERE g.owner_type = 'Department'
			AND g.department = %s
			AND k.modified >= %s
		ORDER BY k.progress DESC
		LIMIT %s
	"""
	return frappe.db.sql(query, (department, start, limit), as_dict=True)
