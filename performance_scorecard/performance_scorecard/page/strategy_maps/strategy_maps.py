import frappe
from frappe.utils import flt, getdate

@frappe.whitelist()
def get_root_nodes():
    """Returns the root Company node(s)."""
    # Assuming one main company for now, or list all companies
    companies = frappe.get_all("Company", fields=["name", "company_name"])
    nodes = []
    for company in companies:
        nodes.append({
            "id": company.name,
            "label": company.company_name,
            "type": "Company",
            "expandable": True,
            "progress": get_company_progress(company.name),
            "meta": ""
        })
    return nodes

@frappe.whitelist()
def get_children(node_type, node_id, context=None):
    """Returns children nodes based on the current node type and ID."""
    if isinstance(context, str):
        try:
            context = frappe.parse_json(context)
        except Exception:
            context = {}
    if context is None:
        context = {}
    children = []
    legacy_map = {
        "Company KPA": "KPA",
        "Department KPA": "KPA",
        "Individual KPA": "KPA",
        "Company Goal": "Goal",
        "Department Goal": "Goal",
        "Individual Goal": "Goal",
        "Department KRA": "KRA",
        "Individual KRA": "KRA",
    }
    node_type = legacy_map.get(node_type, node_type)

    def level_from_context():
        if context.get("employee"):
            return "Employee"
        if context.get("department"):
            return "Department"
        return "Company"

    if node_type == "Company":
        kpas = frappe.get_all("KPA Master", fields=["name", "kpa_name", "weightage"])
        for kpa in kpas:
            children.append({
                "id": kpa.name,
                "label": kpa.kpa_name,
                "type": "KPA",
                "expandable": True,
                "progress": get_kpa_progress(kpa.name, "Company", node_id),
                "meta": f"Weight: {flt(kpa.weightage) or 0}%"
            })

    elif node_type == "KPA":
        level = level_from_context()
        goal_filters = {"kpa": node_id, "status": "Active"}
        if level == "Company":
            goal_filters["owner_type"] = "Company"
        elif level == "Department":
            goal_filters["owner_type"] = "Department"
            goal_filters["department"] = context.get("department")
        else:
            goal_filters["owner_type"] = "Employee"
            goal_filters["employee"] = context.get("employee")

        goals = frappe.get_all(
            "Goal",
            filters=goal_filters,
            fields=["name", "goal_name", "progress", "end_date", "weightage"],
        )
        for goal in goals:
            children.append({
                "id": goal.name,
                "label": goal.goal_name,
                "type": "Goal",
                "expandable": True,
                "progress": goal.progress,
                "end_date": goal.end_date,
                "meta": f"Contribution: {flt(goal.weightage) or 0}%"
            })

    elif node_type == "Goal":
        level = level_from_context()
        if level == "Company":
            dept_goals = frappe.get_all("Goal", filters={
                "parent_goal": node_id,
                "owner_type": "Department"
            }, fields=["department", "progress", "weightage"])

            dept_names = set([d.department for d in dept_goals if d.department])
            for dept in dept_names:
                avg_progress = _avg([d.progress for d in dept_goals if d.department == dept]) or 0
                avg_weight = _avg([d.weightage for d in dept_goals if d.department == dept]) or 0
                children.append({
                    "id": dept,
                    "label": dept,
                    "type": "Department",
                    "expandable": True,
                    "progress": avg_progress,
                    "meta": f"Contribution: {avg_weight:.1f}%"
                })
        else:
            kras = frappe.get_all("KRA", filters={"goal": node_id}, fields=["name", "kra_name", "progress", "weightage"])
            for kra in kras:
                children.append({
                    "id": kra.name,
                    "label": kra.kra_name,
                    "type": "KRA",
                    "expandable": True,
                    "progress": kra.progress,
                    "meta": f"Contribution: {flt(kra.weightage) or 0}%"
                })

    elif node_type == "Department":
        kpas = frappe.get_all("KPA Master", fields=["name", "kpa_name", "weightage"])
        for kpa in kpas:
            children.append({
                "id": kpa.name,
                "label": kpa.kpa_name,
                "type": "KPA",
                "expandable": True,
                "progress": get_kpa_progress(kpa.name, "Department", node_id),
                "meta": f"Weight: {flt(kpa.weightage) or 0}%"
            })

    elif node_type == "KRA":
        level = level_from_context()
        if level == "Department":
            ind_kras = frappe.get_all("KRA", filters={"parent_kra": node_id}, fields=["owner", "progress"])
            employees = []
            for k in ind_kras:
                emp = frappe.db.get_value("Employee", {"user_id": k.owner}, ["name", "employee_name"], as_dict=True)
                if emp:
                    employees.append((emp.name, emp.employee_name, k.progress))

            for emp_id, emp_name, progress in employees:
                children.append({
                    "id": emp_id,
                    "label": emp_name,
                    "type": "Employee",
                    "expandable": True,
                    "progress": progress or 0
                })
        elif level == "Employee":
            items = frappe.db.sql("""
                SELECT item.kpi, item.score, item.actual, item.target
                FROM `tabScorecard Item` item
                JOIN `tabPerformance Scorecard` sc ON sc.name = item.parent
                WHERE item.kra = %s AND sc.employee = %s AND sc.docstatus = 0
                ORDER BY sc.modified DESC LIMIT 10
            """, (node_id, context.get("employee")), as_dict=True)

            seen_kpis = set()
            for item in items:
                if item.kpi not in seen_kpis:
                    kpi_name = frappe.db.get_value("KPI Master", item.kpi, "kpi_name")
                    children.append({
                        "id": item.kpi,
                        "label": kpi_name,
                        "type": "KPI",
                        "expandable": False,
                        "progress": item.score,
                        "meta": f"Target: {item.target or '-'} | Actual: {item.actual or '-'}"
                    })
                    seen_kpis.add(item.kpi)

    elif node_type == "Employee":
        kpas = frappe.get_all("KPA Master", fields=["name", "kpa_name", "weightage"])
        for kpa in kpas:
            children.append({
                "id": kpa.name,
                "label": kpa.kpa_name,
                "type": "KPA",
                "expandable": True,
                "progress": get_kpa_progress(kpa.name, "Individual", node_id),
                "meta": f"Weight: {flt(kpa.weightage) or 0}%"
            })

    return children

def get_company_progress(company):
    # Avg of all Company Goals
    goals = frappe.get_all("Goal", filters={"owner_type": "Company", "status": "Active"}, fields=["progress"])
    if not goals: return 0
    return sum([flt(g.progress) for g in goals]) / len(goals)

def get_kpa_progress(kpa, level, owner_id):
    filters = {"kpa": kpa, "status": "Active"}
    if level == "Company":
        filters["owner_type"] = "Company"
    elif level == "Department":
        filters["owner_type"] = "Department"
        filters["department"] = owner_id
    elif level == "Individual":
        filters["owner_type"] = "Employee"
        filters["employee"] = owner_id
        
    goals = frappe.get_all("Goal", filters=filters, fields=["progress"])
    if not goals: return 0
    return sum([flt(g.progress) for g in goals]) / len(goals)

def get_department_progress_for_goal(dept, parent_goal_id):
    goals = frappe.get_all("Goal", filters={"parent_goal": parent_goal_id, "department": dept}, fields=["progress"])
    if not goals: return 0
    return sum([flt(g.progress) for g in goals]) / len(goals)


def _avg(values):
    vals = [flt(v) for v in values if v is not None]
    if not vals:
        return 0
    return sum(vals) / len(vals)


@frappe.whitelist()
def get_strategy_map_data():
    company_goals = frappe.get_all(
        "Goal",
        filters={"owner_type": "Company", "status": "Active"},
        fields=["name", "goal_name"],
    )

    nodes = []
    for company_goal in company_goals:
        dept_goals = frappe.get_all(
            "Goal",
            filters={"owner_type": "Department", "parent_goal": company_goal.name},
            fields=["name", "goal_name"],
        )
        dept_nodes = []
        for dept_goal in dept_goals:
            emp_goals = frappe.get_all(
                "Goal",
                filters={"owner_type": "Employee", "parent_goal": dept_goal.name},
                fields=["name", "goal_name"],
            )
            emp_nodes = [
                {"label": eg.goal_name, "type": "Individual", "children": []}
                for eg in emp_goals
            ]
            dept_nodes.append(
                {"label": dept_goal.goal_name, "type": "Department", "children": emp_nodes}
            )
        nodes.append(
            {"label": company_goal.goal_name, "type": "Company", "children": dept_nodes}
        )

    return nodes
