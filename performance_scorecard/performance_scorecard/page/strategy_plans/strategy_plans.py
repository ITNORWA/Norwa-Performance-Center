import frappe
from frappe.utils import flt

@frappe.whitelist()
def get_strategy_data(level, period=None, department=None, employee=None):
    # Fetch data based on level (Company, Department, Individual)
    # Return a list of items (Goals -> KRAs -> KPIs)
    
    filters = {"status": ["!=", "Archived"]}
    session_user = frappe.session.user
    session_employee = frappe.db.get_value("Employee", {"user_id": session_user}, "name")
    selected_employee = employee or session_employee
    selected_department = department
    dept_employees = []

    if level == "Company":
        filters["owner_type"] = "Company"
    elif level == "Department":
        filters["owner_type"] = "Department"
        # Filter by user's department
        if session_employee and not selected_department:
            selected_department = frappe.db.get_value("Employee", session_employee, "department")
        if selected_department:
            filters["department"] = selected_department
    elif level == "Individual":
        filters["owner_type"] = "Employee"
        if selected_department:
            filters["department"] = selected_department
            dept_employees = frappe.get_all(
                "Employee",
                filters={"department": selected_department},
                pluck="name",
            )
            if selected_employee and selected_employee not in dept_employees:
                selected_employee = None
        if selected_employee:
            filters["employee"] = selected_employee
        elif selected_department:
            if dept_employees:
                filters["employee"] = ["in", dept_employees]
            else:
                filters["employee"] = "__none__"
        else:
            # Fallback for users without an Employee record
            filters["owner"] = session_user

    goals = frappe.get_all(
        "Goal",
        filters=filters,
        fields=[
            "name",
            "goal_name",
            "weightage",
            "status",
            "start_date",
            "end_date",
            "kpa",
            "progress",
            "parent_goal",
            "owner_type",
            "department",
            "employee",
        ],
    )

    parent_names = [g.parent_goal for g in goals if g.get("parent_goal")]
    goal_name_map = {}
    if parent_names:
        for row in frappe.get_all(
            "Goal",
            filters={"name": ["in", list(set(parent_names))]},
            fields=["name", "goal_name"],
        ):
            goal_name_map[row.name] = row.goal_name

    kpa_map = {}
    kpa_names = [g.kpa for g in goals if g.get("kpa")]
    if kpa_names:
        for row in frappe.get_all(
            "KPA Master",
            filters={"name": ["in", list(set(kpa_names))]},
            fields=["name", "kpa_name"],
        ):
            kpa_map[row.name] = row.kpa_name

    employee_list = []
    if level == "Individual" and not selected_employee:
        if selected_department:
            employee_list = sorted(dept_employees)
        else:
            employee_list = sorted({g.get("employee") for g in goals if g.get("employee")})
        if len(employee_list) == 1:
            selected_employee = employee_list[0]

    scorecard_filters = _get_scorecard_filters(level, selected_employee or employee_list, filters.get("department"), session_user)
    kpi_scorecard_filters = scorecard_filters if level == "Individual" else None
    kpi_employee_filter = (selected_employee or employee_list) if level == "Individual" else None
    data = []
    kra_meta = frappe.get_meta("KRA")
    kra_fields = ["name", "kra_name", "weightage", "priority", "progress"]
    if kra_meta.has_field("description"):
        kra_fields.append("description")
    for goal in goals:
        # Fetch KRAs for this goal
        kras = frappe.get_all(
            "KRA",
            filters={"goal": goal.name},
            fields=kra_fields,
        )

        goal_data = {
            "name": goal.name,
            "goal_name": goal.goal_name,
            "kpa": kpa_map.get(goal.kpa) or goal.kpa,
            "kpa_key": goal.kpa,
            "kpa_label": kpa_map.get(goal.kpa) or goal.kpa,
            "parent_goal": goal.parent_goal,
            "parent_goal_name": goal_name_map.get(goal.parent_goal),
            "weightage": goal.weightage,
            "status": goal.status,
            "start_date": goal.start_date,
            "end_date": goal.end_date,
            "progress": goal.progress or 0,
            "kras": []
        }
        
        for kra in kras:
            # Fetch KPIs for this KRA (assuming link exists or via Scorecard)
            # For now, let's fetch KPIs that link to this KRA (we need to ensure KPI Master has parent_kra or similar, or use a mapping)
            # In our refined DocType, KPI Master has 'parent_kra' (wait, I didn't add it to KPI Master, I added 'goal' to KRA. KPI Master usually links to KRA in the Scorecard Item, but for Strategy Plan we might want a direct link or just list KPIs defined in Master that are relevant)
            # Let's assume KPI Master has a link to KRA or we fetch from Scorecard Items if they exist.
            # Actually, for Strategy Plan, we are defining the plan. So we should probably have KPIs linked to KRA in the Master definition if possible, or just show KRAs.
            # The spec says "Unified Table View".
            
            kpis = _get_kpis_for_kra(kra.name, kpi_scorecard_filters, kpi_employee_filter)
            kpi_scores = [flt(k.get("score")) for k in kpis if k.get("score") is not None]
            kra_progress = sum(kpi_scores) / len(kpi_scores) if kpi_scores else (kra.progress or 0)

            kra_data = {
                "name": kra.name,
                "kra_name": kra.kra_name,
                "weightage": kra.weightage,
                "priority": kra.priority,
                "description": getattr(kra, "description", None),
                "progress": kra_progress,
                "kpis": kpis
            }
            goal_data["kras"].append(kra_data)
            
        data.append(goal_data)

    if level == "Department":
        _apply_department_progress(data, filters.get("department"))
        
    response = {
        "goals": data,
        "meta": {
            "level": level,
            "employee": selected_employee,
            "department": filters.get("department"),
        },
        "personal": {
            "scorecards": [],
            "updates": [],
        },
        "rows": [],
        "rollups": {},
        "company": {},
    }

    if level == "Individual":
        if not selected_employee and not employee_list:
            response["personal"]["scorecards"] = []
            response["personal"]["updates"] = []
            response["rows"] = []
            response["rollups"] = {"kpas": [], "overall_score": 0}
            return response

        if employee_list and not selected_employee:
            scorecard_filters = {"employee": ["in", employee_list], "docstatus": ["in", [0, 1]]}
        else:
            scorecard_filters = {"employee": selected_employee, "docstatus": ["in", [0, 1]]}
        goal_names = [g.get("name") for g in goals if g.get("name")]
        scorecards = frappe.get_all(
            "Performance Scorecard",
            filters=scorecard_filters,
            fields=["name", "status", "start_date", "end_date", "overall_score"],
            order_by="modified desc",
            limit=10,
        )
        if not scorecards and goal_names:
            parent_rows = frappe.get_all(
                "Scorecard Item",
                filters={"goal": ["in", goal_names]},
                pluck="parent"
            )
            parent_names = list(set(parent_rows))
            if parent_names:
                scorecards = frappe.get_all(
                    "Performance Scorecard",
                    filters={"name": ["in", parent_names]},
                    fields=["name", "status", "start_date", "end_date", "overall_score"],
                    order_by="modified desc",
                    limit=10,
                )

        response["personal"]["scorecards"] = scorecards
        if selected_department and not selected_employee:
            response["personal"]["updates"] = []
        elif selected_employee and selected_employee != session_employee:
            response["personal"]["updates"] = []
        else:
            response["personal"]["updates"] = frappe.get_all(
                "Performance Update",
                filters={"owner": session_user},
                fields=["name", "kpi", "actual_value", "status", "modified"],
                order_by="modified desc",
                limit=10,
            )
            _enrich_updates(response["personal"]["updates"])

        latest_scorecard = scorecards[0].name if scorecards else frappe.db.get_value(
            "Performance Scorecard",
            scorecard_filters,
            "name",
            order_by="modified desc",
        )
        if latest_scorecard:
            doc = frappe.get_doc("Performance Scorecard", latest_scorecard)
            for item in doc.items:
                kpi_doc = frappe.get_value(
                    "KPI Master",
                    item.kpi,
                    ["kpi_name", "default_threshold_green", "default_threshold_yellow"],
                    as_dict=True,
                )
                green = (kpi_doc or {}).get("default_threshold_green") or 80
                yellow = (kpi_doc or {}).get("default_threshold_yellow") or 60
                score = item.score or 0
                if score >= green:
                    rating = "On Track"
                elif score >= yellow:
                    rating = "At Risk"
                else:
                    rating = "Off Track"

                response["rows"].append(
                    {
                        "item_name": item.name,
                        "scorecard": latest_scorecard,
                        "kpa": item.kpa,
                        "goal": item.goal,
                        "kra": item.kra,
                        "kpi": item.kpi,
                        "kpi_name": (kpi_doc or {}).get("kpi_name") or item.kpi,
                        "weightage": item.weightage,
                        "target": item.target,
                        "actual": item.actual,
                        "base_actual": getattr(item, "base_actual", None),
                        "score": score,
                        "rating": rating,
                    }
                )

    response["rollups"] = _build_rollups(level, selected_employee, filters.get("department"), session_user)
    if level == "Company":
        response["company"] = _build_company_rollups()
    return response


def _enrich_updates(updates):
    if not updates:
        return

    kpis = [u.get("kpi") for u in updates if u.get("kpi")]
    kpi_map = {}
    if kpis:
        for row in frappe.get_all(
            "KPI Master",
            filters={"name": ["in", list(set(kpis))]},
            fields=["name", "kpi_name", "default_threshold_green", "default_threshold_yellow"],
        ):
            kpi_map[row.name] = row

    for update in updates:
        kpi = update.get("kpi")
        kpi_doc = kpi_map.get(kpi) or {}
        green = kpi_doc.get("default_threshold_green") or 80
        yellow = kpi_doc.get("default_threshold_yellow") or 60
        actual = update.get("actual_value") or 0

        if actual >= green:
            status = "On Track"
            color = "green"
        elif actual >= yellow:
            status = "At Risk"
            color = "yellow"
        else:
            status = "Off Track"
            color = "red"

        update["kpi_name"] = kpi_doc.get("kpi_name") or kpi
        update["threshold_green"] = green
        update["threshold_yellow"] = yellow
        update["status_label"] = status
        update["status_color"] = color


def _get_scorecard_filters(level, employee, department, session_user):
    filters = {"docstatus": ["in", [0, 1]]}
    if level == "Department" and department:
        filters["department"] = department
    elif level == "Individual":
        if employee:
            if isinstance(employee, (list, tuple)):
                filters["employee"] = ["in", list(employee)]
            else:
                filters["employee"] = employee
        else:
            filters["owner"] = session_user
    return filters


def _get_kpis_for_kra(kra_name, scorecard_filters=None, employee_filter=None):
    filters = {"kra": kra_name}
    if employee_filter:
        if isinstance(employee_filter, (list, tuple)):
            filters["employee"] = ["in", list(employee_filter)]
        else:
            filters["employee"] = employee_filter

    kpi_rows = frappe.get_all(
        "KPI Master",
        filters=filters,
        fields=["name", "kpi_name"],
    )

    if not kpi_rows:
        return []

    item_map = {}
    if scorecard_filters:
        scorecards = frappe.get_all(
            "Performance Scorecard",
            filters=scorecard_filters,
            pluck="name"
        )
        if scorecards:
            items = frappe.get_all(
                "Scorecard Item",
                filters={"parent": ["in", scorecards], "kra": kra_name},
                fields=["kpi", "target", "actual", "score"]
            )
            for item in items:
                item_map[item.kpi] = item

    kpis = []
    for row in kpi_rows:
        item = item_map.get(row.name, {})
        kpis.append(
            {
                "kpi": row.name,
                "kpi_name": row.kpi_name,
                "target": item.get("target"),
                "actual": item.get("actual"),
                "score": item.get("score"),
            }
        )

    return kpis


def _build_rollups(level, employee, department, session_user):
    filters = {}
    if level == "Department" and department:
        dept_employees = frappe.get_all("Employee", filters={"department": department}, pluck="name")
        scorecard_names = set()
        if dept_employees:
            scorecard_names.update(
                frappe.get_all(
                    "Performance Scorecard",
                    filters={"employee": ["in", dept_employees]},
                    pluck="name",
                )
            )
        scorecard_names.update(
            frappe.get_all(
                "Performance Scorecard",
                filters={"department": department},
                pluck="name",
            )
        )
        filters["name"] = ["in", list(scorecard_names)] if scorecard_names else "__none__"
    elif level == "Individual":
        if employee:
            if isinstance(employee, (list, tuple)):
                filters["employee"] = ["in", list(employee)]
            else:
                filters["employee"] = employee
        elif department:
            dept_employees = frappe.get_all(
                "Employee",
                filters={"department": department},
                pluck="name",
            )
            if dept_employees:
                filters["employee"] = ["in", dept_employees]
            else:
                filters["employee"] = "__none__"
        else:
            filters["owner"] = session_user

    scorecards = frappe.get_all("Performance Scorecard", filters=filters, pluck="name")
    if not scorecards:
        return {"kpas": [], "overall_score": 0}

    items = frappe.get_all(
        "Scorecard Item",
        filters={"parent": ["in", scorecards]},
        fields=["name", "kpa", "goal", "kra", "kpi", "weightage", "score", "target", "actual", "parent"],
    )

    goal_names = list({i.goal for i in items if i.goal})
    goal_parent = {}
    goal_weights = {}
    goal_kpa = {}
    if goal_names:
        for row in frappe.get_all(
            "Goal",
            filters={"name": ["in", goal_names]},
            fields=["name", "parent_goal", "weightage", "kpa"],
        ):
            goal_parent[row.name] = row.parent_goal
            goal_weights[row.name] = row.weightage or 0
            goal_kpa[row.name] = row.kpa

        if level == "Department":
            dept_goal_names = [g for g in goal_parent.values() if g]
            if dept_goal_names:
                for row in frappe.get_all(
                    "Goal",
                    filters={"name": ["in", list(set(dept_goal_names))]},
                    fields=["name", "weightage", "kpa"],
                ):
                    goal_weights[row.name] = row.weightage or 0
                    goal_kpa[row.name] = row.kpa

    kpa_weights = {
        row.name: (row.weightage or 0)
        for row in frappe.get_all("KPA Master", fields=["name", "weightage"])
    }
    kra_weights = {
        row.name: (row.weightage or 0)
        for row in frappe.get_all("KRA", fields=["name", "weightage"])
    }
    kra_parent = {}
    if level == "Department":
        kra_names = list({i.kra for i in items if i.kra})
        if kra_names:
            for row in frappe.get_all(
                "KRA",
                filters={"name": ["in", kra_names]},
                fields=["name", "parent_kra"],
            ):
                if row.parent_kra:
                    kra_parent[row.name] = row.parent_kra

    rollup = {}
    for item in items:
        goal_name = item.goal
        if level == "Department":
            goal_name = goal_parent.get(item.goal) or item.goal

        kpa = item.kpa or goal_kpa.get(goal_name) or goal_kpa.get(item.goal)
        if not kpa:
            kpa = "Unassigned"

        rollup.setdefault(kpa, {"goals": {}})
        goal_bucket = rollup[kpa]["goals"].setdefault(
            goal_name,
            {"kras": {}, "weightage": goal_weights.get(goal_name) or 0},
        )
        kra_name = kra_parent.get(item.kra) if level == "Department" else item.kra
        if not kra_name:
            continue
        kra_bucket = goal_bucket["kras"].setdefault(
            kra_name,
            {"items": [], "weightage": kra_weights.get(kra_name) or 0},
        )

        weight = item.weightage or 0
        kra_bucket["items"].append(
            {
                "score": item.score or 0,
                "weightage": weight if weight > 0 else 1,
            }
        )

    kpa_rows = []
    overall_sum = 0
    overall_weight = 0
    for kpa, data in rollup.items():
        goal_rows = []
        kpa_sum = 0
        kpa_weight = 0
        for goal_name, goal_data in data["goals"].items():
            kra_rows = []
            goal_sum = 0
            goal_weight = 0
            for kra_name, kra_data in goal_data["kras"].items():
                item_sum = sum(i["score"] * i["weightage"] for i in kra_data["items"])
                item_weight = sum(i["weightage"] for i in kra_data["items"]) or 1
                kra_avg = item_sum / item_weight
                kra_weight = kra_data.get("weightage") or 1

                kra_rows.append(
                    {
                        "kra": kra_name,
                        "average_score": kra_avg,
                        "weightage": kra_weight,
                    }
                )
                goal_sum += kra_avg * kra_weight
                goal_weight += kra_weight

            goal_avg = goal_sum / (goal_weight or 1)
            gw = goal_data.get("weightage") or 1
            goal_rows.append(
                {
                    "goal": goal_name,
                    "average_score": goal_avg,
                    "weightage": gw,
                    "kras": kra_rows,
                }
            )
            kpa_sum += goal_avg * gw
            kpa_weight += gw

        kpa_avg = kpa_sum / (kpa_weight or 1)
        kpa_w = kpa_weights.get(kpa) or 1
        overall_sum += kpa_avg * kpa_w
        overall_weight += kpa_w

        kpa_rows.append(
            {
                "kpa": kpa,
                "average_score": kpa_avg,
                "weightage": kpa_weights.get(kpa) or 0,
                "goals": goal_rows,
            }
        )

    overall_score = overall_sum / (overall_weight or 1)
    return {"kpas": kpa_rows, "overall_score": overall_score}


def _build_company_rollups():
    # Company goals are the parents. Department goals are children (parent_goal).
    company_goals = frappe.get_all(
        "Goal",
        filters={"owner_type": "Company", "status": "Active"},
        fields=["name", "goal_name", "kpa", "weightage"],
    )

    if not company_goals:
        return {"kpas": [], "overall_score": 0}

    company_goal_names = [g.name for g in company_goals]
    dept_goals = frappe.get_all(
        "Goal",
        filters={"owner_type": "Department", "parent_goal": ["in", company_goal_names]},
        fields=["name", "goal_name", "parent_goal", "department", "weightage"],
    )
    dept_goal_names = [g.name for g in dept_goals]
    employee_goals = []
    if dept_goal_names:
        employee_goals = frappe.get_all(
            "Goal",
            filters={"owner_type": "Employee", "parent_goal": ["in", dept_goal_names]},
            fields=["name", "parent_goal", "employee"],
        )
    employee_goal_names = [g.name for g in employee_goals]
    employee_goal_to_dept_goal = {g.name: g.parent_goal for g in employee_goals}

    dept_goal_scores = {}
    if dept_goal_names or employee_goal_names:
        items = frappe.get_all(
            "Scorecard Item",
            filters={"goal": ["in", list(set(dept_goal_names + employee_goal_names))]},
            fields=["goal", "parent", "score", "weightage"],
        )

        scorecard_dept = {}
        scorecard_employee = {}
        if items:
            parent_names = list({i.parent for i in items if i.parent})
            for row in frappe.get_all(
                "Performance Scorecard",
                fields=["name", "department", "employee"],
                filters={"name": ["in", parent_names]},
            ):
                scorecard_dept[row.name] = row.department
                scorecard_employee[row.name] = row.employee

        employee_departments = {}
        employee_names = list({e for e in scorecard_employee.values() if e})
        if employee_names:
            for row in frappe.get_all(
                "Employee",
                filters={"name": ["in", employee_names]},
                fields=["name", "department"],
            ):
                employee_departments[row.name] = row.department

        for item in items:
            dept = scorecard_dept.get(item.parent)
            if not dept:
                emp = scorecard_employee.get(item.parent)
                dept = employee_departments.get(emp)
            if not dept:
                continue

            dept_goal = employee_goal_to_dept_goal.get(item.goal) or item.goal
            if dept_goal not in dept_goal_names:
                continue

            key = (dept_goal, dept)
            bucket = dept_goal_scores.setdefault(key, {"sum": 0, "weight": 0})
            weight = item.weightage or 1
            bucket["sum"] += (item.score or 0) * weight
            bucket["weight"] += weight

    goal_rows = {}
    for goal in company_goals:
        children = [g for g in dept_goals if g.parent_goal == goal.name]
        avg_weightage = 0
        if children:
            avg_weightage = sum((g.weightage or 0) for g in children) / len(children)

        dept_contrib = []
        for child in children:
            for (dept_goal, dept), bucket in dept_goal_scores.items():
                if dept_goal != child.name:
                    continue
                avg_score = (bucket.get("sum") or 0) / (bucket.get("weight") or 1)
                dept_contrib.append(
                    {
                        "department": dept,
                        "average_score": avg_score,
                        "weightage": child.weightage or 0,
                    }
                )

        dept_contrib.sort(key=lambda d: d.get("average_score") or 0, reverse=True)
        worst_dept = dept_contrib[-1] if dept_contrib else None

        goal_avg = 0
        if dept_contrib:
            goal_avg = sum(d.get("average_score") or 0 for d in dept_contrib) / len(dept_contrib)

        goal_rows[goal.name] = {
            "goal_id": goal.name,
            "goal": goal.goal_name,
            "goal_name": goal.goal_name,
            "weightage": goal.weightage or 0,
            "kpa": goal.kpa,
            "avg_dept_weightage": avg_weightage,
            "department_contributions": dept_contrib,
            "worst_department": worst_dept,
            "average_score": goal_avg,
        }

    kpa_groups = {}
    for goal in company_goals:
        kpa = goal.kpa or "Unassigned"
        kpa_groups.setdefault(kpa, []).append(goal_rows.get(goal.name))

    kpa_rows = []
    overall_sum = 0
    overall_weight = 0
    kpa_weights = {
        row.name: (row.weightage or 0)
        for row in frappe.get_all("KPA Master", fields=["name", "weightage"])
    }

    for kpa, goals in kpa_groups.items():
        if not goals:
            continue
        goal_sum = sum((g.get("average_score") or 0) * ((g.get("weightage") or 1)) for g in goals)
        goal_weight = sum((g.get("weightage") or 1) for g in goals) or 1
        kpa_avg = goal_sum / goal_weight

        kpa_weight = kpa_weights.get(kpa) or 1
        overall_sum += kpa_avg * kpa_weight
        overall_weight += kpa_weight

        kpa_rows.append(
            {
                "kpa": kpa,
                "average_score": kpa_avg,
                "weightage": kpa_weights.get(kpa) or 0,
                "goals": goals,
            }
        )

    overall_score = overall_sum / (overall_weight or 1)
    return {"kpas": kpa_rows, "overall_score": overall_score}


def _apply_department_progress(goals, department):
    if not goals or not department:
        return

    dept_goal_names = [g.get("name") for g in goals if g.get("name")]
    if not dept_goal_names:
        return

    employee_goals = frappe.get_all(
        "Goal",
        filters={"owner_type": "Employee", "parent_goal": ["in", dept_goal_names]},
        fields=["name", "parent_goal"],
    )
    employee_goal_names = [g.name for g in employee_goals]
    if not employee_goal_names:
        return

    goal_parent = {g.name: g.parent_goal for g in employee_goals}

    employee_kras = frappe.get_all(
        "KRA",
        filters={"goal": ["in", employee_goal_names]},
        fields=["name", "parent_kra"],
    )
    kra_parent = {k.name: k.parent_kra for k in employee_kras if k.parent_kra}

    items = frappe.get_all(
        "Scorecard Item",
        filters={"goal": ["in", employee_goal_names]},
        fields=["goal", "kra", "score", "weightage"],
    )
    if not items:
        return

    goal_scores = {}
    kra_scores = {}
    for item in items:
        parent_goal = goal_parent.get(item.goal)
        if parent_goal:
            bucket = goal_scores.setdefault(parent_goal, {"sum": 0, "weight": 0})
            weight = item.weightage or 1
            bucket["sum"] += (item.score or 0) * weight
            bucket["weight"] += weight

        parent_kra = kra_parent.get(item.kra)
        if parent_kra:
            bucket = kra_scores.setdefault(parent_kra, {"sum": 0, "weight": 0})
            weight = item.weightage or 1
            bucket["sum"] += (item.score or 0) * weight
            bucket["weight"] += weight

    for goal in goals:
        goal_bucket = goal_scores.get(goal.get("name"))
        if goal_bucket and goal_bucket.get("weight"):
            goal["progress"] = goal_bucket["sum"] / goal_bucket["weight"]

        for kra in goal.get("kras", []):
            kra_bucket = kra_scores.get(kra.get("name"))
            if kra_bucket and kra_bucket.get("weight"):
                kra["progress"] = kra_bucket["sum"] / kra_bucket["weight"]
