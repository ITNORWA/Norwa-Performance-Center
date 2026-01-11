import frappe


def execute():
    report_names = [
        "KRA Priority Report",
        "Overdue KPIs",
        "Scorecards by Department",
        "Scorecards by Status",
        "Weekly Commitments Report",
    ]
    for name in report_names:
        if frappe.db.exists("Report", name):
            frappe.delete_doc("Report", name, ignore_permissions=True)
