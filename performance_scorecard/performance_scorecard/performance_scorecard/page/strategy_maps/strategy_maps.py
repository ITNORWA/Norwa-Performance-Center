import frappe
from frappe.utils import flt, getdate

def get_settings():
    return frappe.get_single("Performance Settings")

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
            "progress": get_company_progress(company.name) # Calculate overall progress
        })
    return nodes

@frappe.whitelist()
def get_children(node_type, node_id, context=None):
    """Returns children nodes based on the current node type and ID."""
    children = []
    settings = get_settings()
    
    if node_type == "Company":
        # Company -> KPAs
        kpas = frappe.get_all("KPA Master", fields=["name", "kpa_name"])
        for kpa in kpas:
            children.append({
                "id": kpa.name,
                "label": kpa.kpa_name,
                "type": "Company KPA",
                "expandable": True,
                "progress": get_kpa_progress(kpa.name, "Company", node_id)
            })

    elif node_type == "Company KPA":
        # Company KPA -> Company Goals
        goals = frappe.get_all("Goal", filters={
            "owner_type": "Company", 
            "parent_kpa": node_id,
            "status": "Active"
        }, fields=["name", "goal_name", "progress", "end_date"])
        
        for goal in goals:
            children.append({
                "id": goal.name,
                "label": goal.goal_name,
                "type": "Company Goal",
                "expandable": True,
                "progress": goal.progress,
                "end_date": goal.end_date
            })

    elif node_type == "Company Goal":
        # Company Goal -> Linked Departments
        dept_goals = frappe.get_all("Goal", filters={
            "parent_goal": node_id,
            "owner_type": "Department"
        }, fields=["department"])
        
        dept_names = set([d.department for d in dept_goals if d.department])
        
        for dept in dept_names:
            children.append({
                "id": dept,
                "label": dept,
                "type": "Department",
                "expandable": True,
                "progress": get_department_progress_for_goal(dept, node_id)
            })

    elif node_type == "Department":
        # Department -> Department KPAs
        kpas = frappe.get_all("KPA Master", fields=["name", "kpa_name"])
        for kpa in kpas:
            children.append({
                "id": kpa.name,
                "label": kpa.kpa_name,
                "type": "Department KPA",
                "expandable": True,
                "progress": get_kpa_progress(kpa.name, "Department", node_id)
            })

    elif node_type == "Department KPA":
        # Department KPA -> Department Goals
        department = context.get("department")
        goals = frappe.get_all("Goal", filters={
            "owner_type": "Department",
            "department": department,
            "parent_kpa": node_id,
            "status": "Active"
        }, fields=["name", "goal_name", "progress", "end_date"])
        
        for goal in goals:
            children.append({
                "id": goal.name,
                "label": goal.goal_name,
                "type": "Department Goal",
                "expandable": True,
                "progress": goal.progress,
                "end_date": goal.end_date
            })

    elif node_type == "Department Goal":
        # Department Goal -> Department KRAs
        kras = frappe.get_all("KRA", filters={"goal": node_id}, fields=["name", "kra_name", "progress"])
        for kra in kras:
            children.append({
                "id": kra.name,
                "label": kra.kra_name,
                "type": "Department KRA",
                "expandable": True if settings.enable_individual_level else False,
                "progress": kra.progress
            })

    elif node_type == "Department KRA" and settings.enable_individual_level:
        # Department KRA -> Linked Employees
        ind_kras = frappe.get_all("KRA", filters={"parent_kra": node_id}, fields=["owner"])
        
        employees = set()
        for k in ind_kras:
            emp = frappe.db.get_value("Employee", {"user_id": k.owner}, ["name", "employee_name"], as_dict=True)
            if emp:
                employees.add((emp.name, emp.employee_name))
        
        for emp_id, emp_name in employees:
            children.append({
                "id": emp_id,
                "label": emp_name,
                "type": "Employee",
                "expandable": True,
                "progress": 0 
            })

    elif node_type == "Employee" and settings.enable_individual_level:
        # Employee -> Individual KPAs
        kpas = frappe.get_all("KPA Master", fields=["name", "kpa_name"])
        for kpa in kpas:
            children.append({
                "id": kpa.name,
                "label": kpa.kpa_name,
                "type": "Individual KPA",
                "expandable": True,
                "progress": 0 
            })

    elif node_type == "Individual KPA" and settings.enable_individual_level:
        # Individual KPA -> Individual Goals
        employee = context.get("employee")
        goals = frappe.get_all("Goal", filters={
            "owner_type": "Employee",
            "employee": employee,
            "parent_kpa": node_id,
            "status": "Active"
        }, fields=["name", "goal_name", "progress", "end_date"])
        
        for goal in goals:
            children.append({
                "id": goal.name,
                "label": goal.goal_name,
                "type": "Individual Goal",
                "expandable": True,
                "progress": goal.progress,
                "end_date": goal.end_date
            })
            
    elif node_type == "Individual Goal" and settings.enable_individual_level:
        # Individual Goal -> Individual KRAs
        kras = frappe.get_all("KRA", filters={"goal": node_id}, fields=["name", "kra_name", "progress"])
        for kra in kras:
            children.append({
                "id": kra.name,
                "label": kra.kra_name,
                "type": "Individual KRA",
                "expandable": True,
                "progress": kra.progress
            })

    elif node_type == "Individual KRA" and settings.enable_individual_level:
        # Individual KRA -> Individual KPIs
        items = frappe.db.sql("""
            SELECT item.kpi, item.score, item.actual, item.target
            FROM `tabScorecard Item` item
            JOIN `tabPerformance Scorecard` sc ON sc.name = item.parent
            WHERE item.kra = %s AND sc.docstatus = 0
            ORDER BY sc.modified DESC LIMIT 10
        """, (node_id,), as_dict=True)
        
        seen_kpis = set()
        for item in items:
            if item.kpi not in seen_kpis:
                kpi_name = frappe.db.get_value("KPI Master", item.kpi, "kpi_name")
                children.append({
                    "id": item.kpi,
                    "label": kpi_name,
                    "type": "Individual KPI",
                    "expandable": False,
                    "progress": item.score 
                })
                seen_kpis.add(item.kpi)

    return children

def get_company_progress(company):
    # Avg of all Company Goals
    goals = frappe.get_all("Goal", filters={"owner_type": "Company", "status": "Active"}, fields=["progress"])
    if not goals: return 0
    return sum([flt(g.progress) for g in goals]) / len(goals)

def get_kpa_progress(kpa, level, owner_id):
    filters = {"parent_kpa": kpa, "status": "Active"}
    if level == "Company":
        filters["owner_type"] = "Company"
    elif level == "Department":
        filters["owner_type"] = "Department"
        filters["department"] = owner_id
        
    goals = frappe.get_all("Goal", filters=filters, fields=["progress"])
    if not goals: return 0
    return sum([flt(g.progress) for g in goals]) / len(goals)

def get_department_progress_for_goal(dept, parent_goal_id):
    goals = frappe.get_all("Goal", filters={"parent_goal": parent_goal_id, "department": dept}, fields=["progress"])
    if not goals: return 0
    return sum([flt(g.progress) for g in goals]) / len(goals)

@frappe.whitelist()
def get_strategy_map_data():
    """
    Backward compatibility method for cached JS files.
    Returns a dummy node instructing the user to clear cache.
    """
    return [{
        "name": "cache_clear",
        "label": "⚠️ Please Clear Browser Cache to view new Strategy Map",
        "type": "System",
        "children": []
    }]
