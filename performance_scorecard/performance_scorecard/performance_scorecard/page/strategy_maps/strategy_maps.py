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
            "meta": "Company"
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
        company_label = _get_company_label(node_id)
        kpas = frappe.get_all("KPA Master", fields=["name", "kpa_name", "weightage"])
        for kpa in kpas:
            children.append({
                "id": kpa.name,
                "label": kpa.kpa_name,
                "type": "KPA",
                "expandable": True,
                "progress": get_kpa_progress(kpa.name, "Company", node_id),
                "meta": f"{company_label} Company KPA · Weight: {flt(kpa.weightage) or 0}%"
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
        context_label = ""
        if level == "Company":
            context_label = f"{_get_company_label(context.get('company') or frappe.db.get_single_value('Global Defaults', 'default_company') or '')} Company Goal"
        elif level == "Department":
            context_label = f"{_get_department_label(context.get('department'))} Department Goal"
        elif level == "Employee":
            context_label = f"{_get_employee_label(context.get('employee'))}'s Goal"
        for goal in goals:
            children.append({
                "id": goal.name,
                "label": goal.goal_name,
                "type": "Goal",
                "expandable": True,
                "progress": goal.progress,
                "end_date": goal.end_date,
                "meta": f"{context_label} · Contribution: {flt(goal.weightage) or 0}%"
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
                    "label": _get_department_label(dept),
                    "type": "Department",
                    "expandable": True,
                    "progress": avg_progress,
                    "meta": f"{_get_department_label(dept)} Department Goal · Contribution: {avg_weight:.1f}%"
                })
        else:
            kras = frappe.get_all("KRA", filters={"goal": node_id}, fields=["name", "kra_name", "progress", "weightage"])
            for kra in kras:
                if level == "Department":
                    dept_label = _get_department_label(context.get("department"))
                    meta_prefix = f"{dept_label} Department KRA"
                elif level == "Employee":
                    meta_prefix = f"{_get_employee_label(context.get('employee'))}'s KRA"
                else:
                    meta_prefix = "KRA"
                children.append({
                    "id": kra.name,
                    "label": kra.kra_name,
                    "type": "KRA",
                    "expandable": True,
                    "progress": kra.progress,
                    "meta": f"{meta_prefix} · Contribution: {flt(kra.weightage) or 0}%"
                })

    elif node_type == "Department":
        dept_label = _get_department_label(node_id)
        kpas = frappe.get_all("KPA Master", fields=["name", "kpa_name", "weightage"])
        for kpa in kpas:
            children.append({
                "id": kpa.name,
                "label": kpa.kpa_name,
                "type": "KPA",
                "expandable": True,
                "progress": get_kpa_progress(kpa.name, "Department", node_id),
                "meta": f"{dept_label} Department KPA · Weight: {flt(kpa.weightage) or 0}%"
            })

    elif node_type == "KRA":
        level = level_from_context()
        if level == "Department":
            department = context.get("department")
            dept_label = _get_department_label(department)
            employees = _get_employee_kra_progress(node_id, department)
            if not employees:
                ind_kras = frappe.get_all("KRA", filters={"parent_kra": node_id}, fields=["owner", "progress"])
                for k in ind_kras:
                    emp = frappe.db.get_value("Employee", {"user_id": k.owner}, ["name", "employee_name"], as_dict=True)
                    if emp:
                        employees.append((emp.name, emp.employee_name, k.progress))
            if not employees and department:
                for emp_id, emp_name in _get_department_employees(department):
                    employees.append((emp_id, emp_name, 0))

            for employee_id, employee_name, progress in employees:
                children.append({
                    "id": employee_id,
                    "label": employee_name or employee_id,
                    "type": "Employee",
                    "expandable": True,
                    "progress": progress or 0,
                    "meta": f"{dept_label} Department"
                })
        elif level == "Employee":
            items = frappe.db.sql("""
                SELECT item.kpi, item.score, item.actual, item.target
                FROM `tabScorecard Item` item
                JOIN `tabPerformance Scorecard` sc ON sc.name = item.parent
                WHERE item.kra = %s AND sc.employee = %s AND sc.docstatus = 0
                ORDER BY sc.modified DESC LIMIT 10
            """, (node_id, context.get("employee")), as_dict=True)

            employee_label = _get_employee_label(context.get("employee"))
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
                        "meta": f"{employee_label}'s KPI · Target: {item.target or '-'} | Actual: {item.actual or '-'}"
                    })
                    seen_kpis.add(item.kpi)

    elif node_type == "Employee":
        employee_label = _get_employee_label(node_id)
        kpas = frappe.get_all("KPA Master", fields=["name", "kpa_name", "weightage"])
        for kpa in kpas:
            children.append({
                "id": kpa.name,
                "label": kpa.kpa_name,
                "type": "KPA",
                "expandable": True,
                "progress": get_kpa_progress(kpa.name, "Individual", node_id),
                "meta": f"{employee_label}'s KPA · Weight: {flt(kpa.weightage) or 0}%"
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


def _get_employee_kra_progress(kra, department):
    if not department:
        return []

    rows = frappe.db.sql("""
        SELECT sc.employee as employee, AVG(IFNULL(item.score, 0)) as score
        FROM `tabScorecard Item` item
        JOIN `tabPerformance Scorecard` sc ON sc.name = item.parent
        JOIN `tabEmployee` emp ON emp.name = sc.employee
        WHERE item.kra = %s AND emp.department = %s
        GROUP BY sc.employee
        ORDER BY score DESC
    """, (kra, department), as_dict=True)

    results = []
    for row in rows:
        employee_id = row.employee
        if not employee_id:
            continue
        employee_name = frappe.db.get_value("Employee", employee_id, "employee_name")
        results.append((employee_id, employee_name, flt(row.score)))
    return results


def _get_department_employees(department):
    if not department:
        return []
    rows = frappe.db.get_all(
        "Employee",
        filters={"department": department},
        fields=["name", "employee_name"],
        order_by="employee_name asc"
    )
    return [(row.name, row.employee_name) for row in rows]


def _get_company_label(company):
    if not company:
        return "Company"
    return frappe.db.get_value("Company", company, "company_name") or company


def _get_department_label(department):
    if not department:
        return "Department"
    return frappe.db.get_value("Department", department, "department_name") or department


def _get_employee_label(employee):
    if not employee:
        return "Employee"
    return frappe.db.get_value("Employee", employee, "employee_name") or employee


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
