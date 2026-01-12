import frappe
from frappe.utils import add_days, add_months, nowdate


@frappe.whitelist()
def get_dashboard_data():
	user = frappe.session.user
	employee = frappe.db.get_value("Employee", {"user_id": user}, "name")
	department = frappe.db.get_value("Employee", employee, "department") if employee else None
	chart_employee, chart_department = _get_employee_profile(user)

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
		"quarterly_top_kras": [],
		"kpa_weights": [],
		"kpa_palette": []
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
	if chart_department:
		data["kra_progress"]["department"] = _get_kra_progress_by_kpa(owner_type="Department", department=chart_department)
	if chart_employee:
		data["kra_progress"]["individual"] = _get_kra_progress_by_kpa(owner_type="Employee", employee=chart_employee)

	data["attention_company"] = _get_kra_attention(owner_type="Company")
	if chart_department:
		data["attention_department"] = _get_kra_attention(owner_type="Department", department=chart_department)
	if chart_employee:
		data["attention_individual"] = _get_kra_attention(owner_type="Employee", employee=chart_employee)

	if chart_employee:
		data["weekly_top_kras"] = _get_top_goals_by_period(chart_employee, days=7, limit=5)
		data["quarterly_top_kras"] = _get_top_goals_by_period(chart_employee, months=3, limit=5)

	data["kpa_weights"] = _get_kpa_weightages()
	data["kpa_palette"] = _get_kpa_palette()

	return data


@frappe.whitelist()
def get_dashboard_insights(department=None, employee=None):
	user = frappe.session.user
	profile_employee, profile_department = _get_employee_profile(user)
	selected_department = department or profile_department
	selected_employee = employee if employee or department else profile_employee
	employee_department = None

	if selected_employee:
		employee_department = frappe.db.get_value("Employee", selected_employee, "department")
		if selected_department and employee_department and employee_department != selected_department:
			selected_employee = None
		elif not selected_department:
			selected_department = employee_department

	insights = {
		"meta": {
			"employee": selected_employee,
			"department": selected_department
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

	if selected_department:
		insights["department"] = {
			"kpa_scores": _get_department_kpa_scores(selected_department),
			"employee_distribution": _get_department_distribution(selected_department),
			"goal_achievement_rate": _get_department_goal_achievement(selected_department),
			"at_risk_kpis": _get_department_at_risk_kpis(selected_department),
			"trend": _get_department_trend(selected_department),
			"top_employees": _get_department_top_employees(selected_department)
		}

	if selected_employee:
		dept_for_employee = selected_department or employee_department
		insights["employee"] = {
			"scorecard": _get_employee_scorecard(selected_employee),
			"goal_progress": _get_employee_goal_progress(selected_employee),
			"department_average": _get_department_average(dept_for_employee),
			"at_risk_kpis": _get_employee_at_risk_kpis(selected_employee),
			"kpi_targets": _get_employee_kpi_targets(selected_employee),
			"trend": _get_employee_trend(selected_employee)
		}

	return insights


def _get_employee_profile(user):
	employee = frappe.db.get_value("Employee", {"user_id": user}, "name")
	department = None
	if employee:
		department = frappe.db.get_value("Employee", employee, "department")
	if not department:
		department = frappe.defaults.get_user_default("Department")
	if not employee:
		employee = frappe.defaults.get_user_default("Employee")
	if employee and not department:
		department = frappe.db.get_value("Employee", employee, "department")
	if not department:
		department = frappe.db.get_value(
			"Performance Scorecard",
			{"department": ["is", "set"]},
			"department",
			order_by="modified desc"
		)
	if not employee:
		employee = frappe.db.get_value(
			"Performance Scorecard",
			{"employee": ["is", "set"]},
			"employee",
			order_by="modified desc"
		)
	return employee, department


def _get_company_kpa_scores():
	# KPI-based KPA averages across all scorecards
	return _get_kra_progress_by_kpa(owner_type="Company")


def _get_department_comparison():
	rows = frappe.db.get_all(
		"Goal",
		filters={"owner_type": "Department"},
		fields=["name", "department"]
	)

	grouped = {}
	for row in rows:
		dept = row.department
		if not dept:
			continue
		grouped.setdefault(dept, []).append(row.name)

	comparison = []
	for dept, dept_goals in grouped.items():
		employee_goals = frappe.db.get_all(
			"Goal",
			filters={"owner_type": "Employee", "parent_goal": ["in", dept_goals]},
			pluck="name"
		)
		goal_names = dept_goals + employee_goals
		value = _avg_score_for_goals(goal_names, department=dept)
		comparison.append({"label": dept, "value": value})

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
	# KPI-based KPA averages for the department
	return _get_kra_progress_by_kpa(owner_type="Department", department=department)


def _get_department_top_employees(department, limit=5):
	rows = frappe.db.get_all(
		"Performance Scorecard",
		filters={"department": department},
		fields=["employee", "overall_score", "modified"],
		order_by="modified desc"
	)

	latest = {}
	for row in rows:
		if row.employee and row.employee not in latest:
			latest[row.employee] = row.overall_score or 0

	entries = []
	for emp, score in latest.items():
		label = frappe.db.get_value("Employee", emp, "employee_name") or emp
		entries.append({"label": label, "value": score})

	entries.sort(key=lambda x: x["value"], reverse=True)
	return entries[:limit]

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
	dept_goals = frappe.db.get_all(
		"Goal",
		filters={"owner_type": "Department", "department": department},
		fields=["name", "progress"]
	)
	if not dept_goals:
		return 0

	goal_scores = []
	for goal in dept_goals:
		progress = goal.progress
		if progress is None:
			progress = _avg_score_for_goals([goal.name], department=department)
		goal_scores.append(progress or 0)

	return sum(goal_scores) / len(goal_scores) if goal_scores else 0


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
		fields=["name", "goal_name"]
	)
	items = []
	for goal in goals:
		kras = frappe.db.get_all(
			"KRA",
			filters={"goal": goal.name},
			pluck="name"
		)
		if kras:
			kra_scores = [_avg_score_for_kra(kra, employee=employee) for kra in kras]
			progress = sum(kra_scores) / len(kra_scores) if kra_scores else 0
		else:
			progress = 0
		items.append({"goal_name": goal.goal_name, "progress": progress})
	average = sum([g["progress"] for g in items]) / len(items) if items else 0
	return {"items": items, "average": average}


def _avg_score_for_goals(goal_names, department=None, employee=None):
	if not goal_names:
		return 0
	placeholders = ", ".join(["%s"] * len(goal_names))
	conditions = [f"si.goal IN ({placeholders})", "ps.docstatus = 0"]
	values = list(goal_names)
	if department:
		conditions.append("(ps.department = %s OR e.department = %s)")
		values.extend([department, department])
	if employee:
		conditions.append("ps.employee = %s")
		values.append(employee)
	query = f"""
		SELECT AVG(
			CASE
				WHEN si.score IS NOT NULL THEN si.score
				WHEN si.target IS NOT NULL AND si.target != 0 THEN (IFNULL(si.actual, 0) / si.target) * 100
				ELSE 0
			END
		) as avg_score
		FROM `tabScorecard Item` si
		INNER JOIN `tabPerformance Scorecard` ps ON ps.name = si.parent
		LEFT JOIN `tabEmployee` e ON e.name = ps.employee
		WHERE {' AND '.join(conditions)}
	"""
	rows = frappe.db.sql(query, values, as_dict=True)
	if not rows:
		return 0
	return rows[0].get("avg_score") or 0


def _avg_score_for_kra(kra, department=None, employee=None):
	if not kra:
		return 0
	conditions = ["si.kra = %s", "ps.docstatus = 0"]
	values = [kra]
	if department:
		conditions.append("(ps.department = %s OR e.department = %s)")
		values.extend([department, department])
	if employee:
		conditions.append("ps.employee = %s")
		values.append(employee)
	query = f"""
		SELECT AVG(
			CASE
				WHEN si.score IS NOT NULL THEN si.score
				WHEN si.target IS NOT NULL AND si.target != 0 THEN (IFNULL(si.actual, 0) / si.target) * 100
				ELSE 0
			END
		) as avg_score
		FROM `tabScorecard Item` si
		INNER JOIN `tabPerformance Scorecard` ps ON ps.name = si.parent
		LEFT JOIN `tabEmployee` e ON e.name = ps.employee
		WHERE {' AND '.join(conditions)}
	"""
	rows = frappe.db.sql(query, values, as_dict=True)
	if not rows:
		return 0
	return rows[0].get("avg_score") or 0


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


def _get_employee_kpi_targets(employee, limit=6):
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
		filters={"parent": scorecard},
		fields=["kpi", "target", "actual"],
		order_by="modified desc",
		limit=limit
	)
	if not items:
		return []

	kpis = [item.kpi for item in items if item.kpi]
	kpi_names = {}
	if kpis:
		for row in frappe.db.get_all(
			"KPI Master",
			filters={"name": ["in", list(set(kpis))]},
			fields=["name", "kpi_name"]
		):
			kpi_names[row.name] = row.kpi_name

	return [
		{
			"label": kpi_names.get(item.kpi) or item.kpi,
			"target": item.target,
			"actual": item.actual
		}
		for item in items
	]


def _get_goal_kpa_field():
	if frappe.db.has_column("Goal", "kpa"):
		return "kpa"
	if frappe.db.has_column("Goal", "parent_kpa"):
		return "parent_kpa"
	
	return None


def _get_kra_progress_by_kpa(owner_type, department=None, employee=None):
	conditions = ["si.kpa IS NOT NULL", "si.kpa != ''"]
	values = []
	if owner_type == "Department" and department:
		conditions.append("(ps.department = %s OR e.department = %s)")
		values.extend([department, department])
	if owner_type == "Employee" and employee:
		conditions.append("ps.employee = %s")
		values.append(employee)

	query = f"""
		SELECT si.kpa as kpa,
			AVG(
				CASE
					WHEN si.score IS NOT NULL THEN si.score
					WHEN si.target IS NOT NULL AND si.target != 0 THEN (IFNULL(si.actual, 0) / si.target) * 100
					ELSE 0
				END
			) as value
		FROM `tabScorecard Item` si
		INNER JOIN `tabPerformance Scorecard` ps ON ps.name = si.parent
		LEFT JOIN `tabEmployee` e ON e.name = ps.employee
		WHERE {' AND '.join(conditions)}
		GROUP BY si.kpa
		ORDER BY si.kpa ASC
	"""
	rows = frappe.db.sql(query, values, as_dict=True)
	values_by_kpa = {
		row.get("kpa"): row.get("value", 0)
		for row in rows
		if row.get("kpa")
	}

	kpa_rows = frappe.db.get_all(
		"KPA Master",
		fields=["name", "kpa_name"],
		order_by="kpa_name asc"
	)
	kpa_order = [row.name for row in kpa_rows if row.name]
	kpa_labels = {row.name: (row.kpa_name or row.name) for row in kpa_rows}

	if not kpa_order:
		return [
			{"label": kpa, "value": value}
			for kpa, value in values_by_kpa.items()
		]

	ordered = [
		{"label": kpa_labels.get(name, name), "value": values_by_kpa.get(name, 0)}
		for name in kpa_order
	]
	extras = [
		{"label": kpa_labels.get(name, name), "value": value}
		for name, value in values_by_kpa.items()
		if name not in kpa_order
	]
	return ordered + extras


def _get_kpa_weightages():
	rows = frappe.db.get_all(
		"KPA Master",
		fields=["name", "kpa_name", "weightage"],
		order_by="kpa_name asc"
	)
	return [
		{"label": (row.kpa_name or row.name), "value": (row.weightage or 0)}
		for row in rows
		if row.kpa_name or row.name
	]


def _get_kpa_palette():
	return ["#F47920", "#009DDC", "#00A651", "#BDBDBD"]


def _get_kra_attention(owner_type, department=None, employee=None, limit=5):
	conditions = {"owner_type": owner_type}
	if department:
		conditions["department"] = department
	if employee:
		conditions["employee"] = employee

	kras = frappe.db.get_all(
		"KRA",
		filters=conditions,
		fields=["name", "kra_name"]
	)

	results = []
	for kra in kras:
		score = _avg_score_for_kra(
			kra.name,
			department=department if owner_type == "Department" else None,
			employee=employee if owner_type == "Employee" else None,
		)
		score = score or 0
		if score < 60:
			results.append({"name": kra.name, "label": kra.kra_name, "value": score})

	results.sort(key=lambda r: r.get("value", 0))
	return results[:limit]


def _get_top_goals_by_period(employee, days=None, months=None, limit=5):
	if not employee:
		return []

	if days:
		start = add_days(nowdate(), -days)
	elif months:
		start = add_months(nowdate(), -months)
	else:
		start = add_months(nowdate(), -3)

	query = """
		SELECT g.name,
			g.goal_name as label,
			IFNULL(g.progress, 0) as value,
			'Goal' as doctype
		FROM `tabGoal` g
		WHERE g.owner_type = 'Employee'
			AND g.employee = %s
			AND g.modified >= %s
		ORDER BY g.progress DESC
		LIMIT %s
	"""
	return frappe.db.sql(query, (employee, start, limit), as_dict=True)
