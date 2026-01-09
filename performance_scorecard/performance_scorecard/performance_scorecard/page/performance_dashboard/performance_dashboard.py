import frappe
from frappe.utils import flt, getdate, nowdate, add_days

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
        data["objectives"] = frappe.get_all("Goal", 
            filters={"employee": employee, "status": "Active"},
            fields=["name", "goal_name", "status", "progress", "end_date"]
        )

        # 2. My Key Results (KRAs)
        goals = [g.name for g in data["objectives"]]
        if goals:
            data["key_results"] = frappe.get_all("KRA",
                filters={"goal": ["in", goals]},
                fields=["name", "kra_name", "weightage", "progress", "priority"]
            )

        # 3. Needs Attention (Underperforming KPIs from Scorecards)
        scorecard_filters = {"employee": employee, "docstatus": 0}
        latest_scorecard = frappe.db.get_value("Performance Scorecard", 
            scorecard_filters, "name", order_by="creation desc")
        
        if latest_scorecard:
            scorecard_doc = frappe.get_doc("Performance Scorecard", latest_scorecard)
            critical = data["settings"]["critical_threshold"]
            for item in scorecard_doc.items:
                if item.score and item.score < critical:
                    data["needs_attention"].append({
                        "kpi": item.kpi,
                        "kpi_name": frappe.db.get_value("KPI Master", item.kpi, "kpi_name") or item.kpi,
                        "score": item.score,
                        "target": item.target,
                        "actual": item.actual
                    })

        # 4. My Tasks (Draft Updates)
        data["tasks"] = frappe.get_all("Performance Update",
            filters={"owner": user, "status": "Draft"},
            fields=["name", "kpi", "status", "modified"],
            order_by="modified desc"
        )

        # 5. KPIs Needing Update (Based on Frequency - Placeholder logic)
        # In a real app, we'd check last update date vs frequency
        all_kpis = frappe.get_all("KPI Master", 
            filters={"status": "Active"}, 
            fields=["name", "kpi_name", "frequency"]
        )
        # For demo, just pick a few or check missing updates
        data["kpis_needing_update"] = all_kpis[:3] 

        # 6. Recent KPI Updates
        data["recent_updates"] = frappe.get_all("Performance Update",
            filters={"owner": user},
            fields=["name", "kpi", "actual_value", "modified"],
            order_by="modified desc",
            limit=5
        )
        for update in data["recent_updates"]:
            update["kpi_name"] = frappe.db.get_value("KPI Master", update.kpi, "kpi_name") or update.kpi

    return data
