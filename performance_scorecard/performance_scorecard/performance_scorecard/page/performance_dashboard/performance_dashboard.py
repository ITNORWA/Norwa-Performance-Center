import frappe

@frappe.whitelist()
def get_dashboard_data():
    user = frappe.session.user
    employee = frappe.db.get_value("Employee", {"user_id": user}, "name")
    settings = frappe.get_single("Performance Settings")
    
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
        "settings": {
            "critical_threshold": settings.critical_threshold or 50,
            "warning_threshold": settings.warning_threshold or 75,
            "success_threshold": settings.success_threshold or 76
        }
    }

    if employee:
        # 1. My Key Objectives (Goals)
        data["objectives"] = frappe.db.get_list("Goal", 
            filters={"employee": employee, "status": "Active"},
            fields=["name", "goal_name", "status"]
        )

        # 2. My Key Results (KRAs)
        goals = [g.name for g in data["objectives"]]
        if goals:
            data["key_results"] = frappe.db.get_list("KRA",
                filters={"goal": ["in", goals]},
                fields=["name", "kra_name", "weightage"]
            )

        # 3. Needs Attention (Overdue/Underperforming KPIs)
        latest_scorecard = frappe.db.get_value("Performance Scorecard", 
            {"employee": employee, "docstatus": 0}, "name", order_by="creation desc")
        
        if latest_scorecard:
            scorecard_doc = frappe.get_doc("Performance Scorecard", latest_scorecard)
            critical = data["settings"]["critical_threshold"]
            for item in scorecard_doc.items:
                if item.score and item.score < critical:
                    data["needs_attention"].append({
                        "kpi": item.kpi,
                        "score": item.score,
                        "target": item.target,
                        "actual": item.actual
                    })

        # 4. My Tasks (Pending Updates)
        data["tasks"] = frappe.db.get_list("Performance Update",
            filters={"owner": user, "status": "Draft"},
            fields=["name", "kpi", "status", "modified"]
        )

        # 6. Recent KPI Updates
        data["recent_updates"] = frappe.db.get_list("Performance Update",
            filters={"owner": user},
            fields=["kpi", "actual_value", "modified"],
            order_by="modified desc",
            limit=5
        )

    return data
