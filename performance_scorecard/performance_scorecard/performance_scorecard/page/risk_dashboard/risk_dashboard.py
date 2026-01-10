import frappe
from frappe.utils import flt, getdate, add_months

@frappe.whitelist()
def get_dashboard_data():
    """
    Returns KPIs and chart data for the Risk Dashboard.
    """
    data = {
        "total_open": 0,
        "high_risks": 0,
        "appetite_breaches": 0,
        "overdue_reviews": 0,
        "categories": [],
        "trend": [],
        "departments": []
    }

    if not frappe.db.table_exists("tabRisk Register"):
        return data
    
    # 1. KPIs
    data['total_open'] = frappe.db.count("Risk Register", {"status": ["!=", "Closed"]})
    data['high_risks'] = frappe.db.count("Risk Register", {"risk_level": "High", "status": ["!=", "Closed"]})
    data['appetite_breaches'] = frappe.db.count("Risk Register", {"risk_appetite_breach": 1, "status": ["!=", "Closed"]})
    data['overdue_reviews'] = frappe.db.count("Risk Register", {"review_date": ["<", getdate()], "status": ["!=", "Closed"]})
    
    # 2. Risk Categories (Pie Chart)
    categories = frappe.db.sql("""
        SELECT risk_category, COUNT(*) as count 
        FROM `tabRisk Register` 
        WHERE status != 'Closed' 
        GROUP BY risk_category
    """, as_dict=True)
    data['categories'] = categories
    
    # 3. Risk Trend (Last 6 Months)
    # This is a bit complex as we don't have a history table. 
    # For now, let's use the identified_date to show new risks per month.
    trend = []
    for i in range(5, -1, -1):
        date = add_months(getdate(), -i)
        month_start = date.replace(day=1)
        # Simplified trend: count of risks identified in that month
        count = frappe.db.count("Risk Register", {
            "identified_date": ["between", [month_start, date]]
        })
        trend.append({
            "month": month_start.strftime("%b %Y"),
            "count": count
        })
    data['trend'] = trend
    
    # 4. Risks by Department (Bar Chart)
    # Since Risk Register doesn't have a department field directly (it has owner_role which is User),
    # we might need to join with Employee or just use Category as a proxy if it maps to Dept.
    # Let's try to get department from the owner (User -> Employee -> Department)
    dept_data = frappe.db.sql("""
        SELECT emp.department, COUNT(risk.name) as count
        FROM `tabRisk Register` risk
        JOIN `tabUser` u ON u.name = risk.owner
        JOIN `tabEmployee` emp ON emp.user_id = u.name
        WHERE risk.status != 'Closed'
        GROUP BY emp.department
    """, as_dict=True)
    data['departments'] = dept_data
    
    return data
