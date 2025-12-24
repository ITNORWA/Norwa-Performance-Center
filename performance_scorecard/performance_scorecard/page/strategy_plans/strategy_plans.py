import frappe

@frappe.whitelist()
def get_strategy_data(level, period=None):
    # Fetch data based on level (Company, Department, Individual)
    # Return a list of items (Goals -> KRAs -> KPIs)
    
    filters = {"status": "Active"}
    if level == "Company":
        filters["owner_type"] = "Company"
    elif level == "Department":
        filters["owner_type"] = "Department"
        # Filter by user's department
        employee = frappe.db.get_value("Employee", {"user_id": frappe.session.user}, "name")
        if employee:
            dept = frappe.db.get_value("Employee", employee, "department")
            filters["department"] = dept
    elif level == "Individual":
        filters["owner_type"] = "Employee"
        employee = frappe.db.get_value("Employee", {"user_id": frappe.session.user}, "name")
        if employee:
            filters["employee"] = employee

    goals = frappe.get_all("Goal", filters=filters, fields=["name", "goal_name", "parent_kpa", "weightage", "status", "start_date", "end_date"])
    
    data = []
    for goal in goals:
        # Fetch KRAs for this goal
        kras = frappe.get_all("KRA", filters={"goal": goal.name}, fields=["name", "kra_name", "weightage", "priority", "description"])
        
        goal_data = {
            "name": goal.name,
            "goal_name": goal.goal_name,
            "kpa": goal.parent_kpa,
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
        
    return data
