import frappe

@frappe.whitelist()
def get_strategy_data(level, period=None, department=None):
    # Fetch data based on level (Company, Department, Individual)
    # Return a list of items (Goals -> KRAs -> KPIs)
    
    filters = {"status": "Active"}
    employee = None
    session_user = frappe.session.user
    employee = frappe.db.get_value("Employee", {"user_id": session_user}, "name")

    if level == "Company":
        filters["owner_type"] = "Company"
    elif level == "Department":
        filters["owner_type"] = "Department"
        # Filter by user's department
        if employee:
            dept = frappe.db.get_value("Employee", employee, "department")
            filters["department"] = dept
        if department:
            filters["department"] = department
    elif level == "Individual":
        filters["owner_type"] = "Employee"
        if employee:
            filters["employee"] = employee
        else:
            # Fallback for users without an Employee record
            filters["owner"] = session_user

    goals = frappe.get_all(
        "Goal",
        filters=filters,
        fields=["name", "goal_name", "weightage", "status", "start_date", "end_date", "kpa", "progress"],
    )

    kpa_map = {}
    kpa_names = [g.kpa for g in goals if g.get("kpa")]
    if kpa_names:
        for row in frappe.get_all(
            "KPA Master",
            filters={"name": ["in", list(set(kpa_names))]},
            fields=["name", "kpa_name"],
        ):
            kpa_map[row.name] = row.kpa_name

    scorecard_filters = _get_scorecard_filters(level, employee, filters.get("department"), session_user)
    data = []
    for goal in goals:
        # Fetch KRAs for this goal
        kras = frappe.get_all(
            "KRA",
            filters={"goal": goal.name},
            fields=["name", "kra_name", "weightage", "priority", "description", "progress"],
        )

        goal_data = {
            "name": goal.name,
            "goal_name": goal.goal_name,
            "kpa": kpa_map.get(goal.kpa) or goal.kpa,
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
            
            kra_data = {
                "name": kra.name,
                "kra_name": kra.kra_name,
                "weightage": kra.weightage,
                "priority": kra.priority,
                "description": kra.description,
                "progress": kra.progress or 0,
                "kpis": _get_kpis_for_kra(kra.name, scorecard_filters)
            }
            goal_data["kras"].append(kra_data)
            
        data.append(goal_data)
        
    response = {
        "goals": data,
        "meta": {
            "level": level,
            "employee": employee,
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
        scorecard_filters = {"employee": employee} if employee else {"owner": session_user}
        response["personal"]["scorecards"] = frappe.get_all(
            "Performance Scorecard",
            filters=scorecard_filters,
            fields=["name", "status", "start_date", "end_date", "overall_score"],
            order_by="modified desc",
            limit=10,
        )
        response["personal"]["updates"] = frappe.get_all(
            "Performance Update",
            filters={"owner": session_user},
            fields=["name", "kpi", "actual_value", "status", "modified"],
            order_by="modified desc",
            limit=10,
        )
        _enrich_updates(response["personal"]["updates"])

        latest_scorecard = frappe.db.get_value(
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
                        "score": score,
                        "rating": rating,
                    }
                )

    response["rollups"] = _build_rollups(level, employee, filters.get("department"), session_user)
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
    filters = {"docstatus": 0}
    if level == "Department" and department:
        filters["department"] = department
    elif level == "Individual":
        if employee:
            filters["employee"] = employee
        else:
            filters["owner"] = session_user
    return filters


def _get_kpis_for_kra(kra_name, scorecard_filters):
    scorecards = frappe.get_all(
        "Performance Scorecard",
        filters=scorecard_filters,
        pluck="name"
    )
    if not scorecards:
        return []

    items = frappe.get_all(
        "Scorecard Item",
        filters={"parent": ["in", scorecards], "kra": kra_name},
        fields=["kpi", "target", "actual", "score"]
    )

    kpi_names = list({i.kpi for i in items if i.kpi})
    kpi_map = {}
    if kpi_names:
        for row in frappe.get_all(
            "KPI Master",
            filters={"name": ["in", kpi_names]},
            fields=["name", "kpi_name"]
        ):
            kpi_map[row.name] = row.kpi_name

    seen = set()
    kpis = []
    for item in items:
        if item.kpi in seen:
            continue
        seen.add(item.kpi)
        kpis.append(
            {
                "kpi": item.kpi,
                "kpi_name": kpi_map.get(item.kpi) or item.kpi,
                "target": item.target,
                "actual": item.actual,
                "score": item.score,
            }
        )

    return kpis


def _build_rollups(level, employee, department, session_user):
    filters = {}
    if level == "Department" and department:
        filters["department"] = department
    elif level == "Individual":
        if employee:
            filters["employee"] = employee
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

    kpa_weights = {
        row.name: (row.weightage or 0)
        for row in frappe.get_all("KPA Master", fields=["name", "weightage"])
    }
    goal_weights = {
        row.name: (row.weightage or 0)
        for row in frappe.get_all("Goal", fields=["name", "weightage", "kpa"])
    }
    goal_kpa = {
        row.name: row.kpa
        for row in frappe.get_all("Goal", fields=["name", "kpa"])
    }
    kra_weights = {
        row.name: (row.weightage or 0)
        for row in frappe.get_all("KRA", fields=["name", "weightage"])
    }

    rollup = {}
    for item in items:
        kpa = item.kpa or goal_kpa.get(item.goal)
        if not kpa:
            kpa = "Unassigned"

        rollup.setdefault(kpa, {"goals": {}})
        goal_bucket = rollup[kpa]["goals"].setdefault(item.goal, {"kras": {}, "weightage": goal_weights.get(item.goal) or 0})
        kra_bucket = goal_bucket["kras"].setdefault(item.kra, {"items": [], "weightage": kra_weights.get(item.kra) or 0})

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

    # Map department -> scorecard names for faster lookup
    scorecards_by_dept = {}
    for row in frappe.get_all(
        "Performance Scorecard",
        fields=["name", "department"],
        filters={"department": ["!=", ""]},
    ):
        scorecards_by_dept.setdefault(row.department, []).append(row.name)

    dept_goal_scores = {}
    if dept_goals:
        dept_goal_names = [g.name for g in dept_goals]
        items = frappe.get_all(
            "Scorecard Item",
            filters={"goal": ["in", dept_goal_names]},
            fields=["goal", "parent", "score", "weightage"],
        )

        for item in items:
            dept = None
            for d, scorecards in scorecards_by_dept.items():
                if item.parent in scorecards:
                    dept = d
                    break
            if not dept:
                continue

            key = (item.goal, dept)
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
            dept = child.department
            bucket = dept_goal_scores.get((child.name, dept), {})
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
