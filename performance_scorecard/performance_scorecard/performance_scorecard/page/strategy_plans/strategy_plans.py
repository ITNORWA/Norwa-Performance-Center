import frappe

@frappe.whitelist()
def get_strategy_data(level, period=None):
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
        fields=["name", "goal_name", "weightage", "status", "start_date", "end_date"],
    )

    data = []
    for goal in goals:
        # Fetch KRAs for this goal
        kras = frappe.get_all("KRA", filters={"goal": goal.name}, fields=["name", "kra_name", "weightage", "priority", "description"])
        
        goal_data = {
            "name": goal.name,
            "goal_name": goal.goal_name,
            "kpa": None,
            "weightage": goal.weightage,
            "status": goal.status,
            "start_date": goal.start_date,
            "end_date": goal.end_date,
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
                "kpis": [] # Placeholder for now
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
                        "kpa": item.kpa,
                        "goal": item.goal,
                        "kra": item.kra,
                        "kpi": item.kpi,
                        "kpi_name": (kpi_doc or {}).get("kpi_name") or item.kpi,
                        "target": item.target,
                        "actual": item.actual,
                        "score": score,
                        "rating": rating,
                    }
                )

    return response
