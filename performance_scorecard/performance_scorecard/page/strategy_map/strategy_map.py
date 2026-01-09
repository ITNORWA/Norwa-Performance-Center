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
            "progress": get_company_progress(company.name) # Calculate overall progress
        })
    return nodes

@frappe.whitelist()
def get_children(node_type, node_id, context=None):
    """Returns children nodes based on the current node type and ID."""
    children = []
    
    if node_type == "Company":
        # Company -> KPAs
        # Fetch all KPAs (assuming they are generic masters, but we treat them as Company Level here)
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
        # context should contain company_id if needed, but here we just find Company Goals linked to this KPA
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
        # Find Department Goals that have this Company Goal as parent
        dept_goals = frappe.get_all("Goal", filters={
            "parent_goal": node_id,
            "owner_type": "Department"
        }, fields=["department"])
        
        # Unique departments
        dept_names = set([d.department for d in dept_goals if d.department])
        
        for dept in dept_names:
            children.append({
                "id": dept,
                "label": dept,
                "type": "Department",
                "expandable": True,
                "progress": get_department_progress_for_goal(dept, node_id) # Progress of this dept on this specific parent goal
            })

    elif node_type == "Department":
        # Department -> Department KPAs
        # We list KPAs again, but context is now Department
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
        # Need department from context (passed as parent_id of the Department node? No, we need to pass context down)
        # We'll encode context in the ID or pass it separately. 
        # Let's assume the UI passes the 'department' in the context dict.
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
        # Actually, Department Goals usually link to Individual Goals directly in the previous logic?
        # User said: "When I select the one of the goals it opens an arrow to linked departmental KRA"
        # So Department Goals have KRAs? Yes, KRA DocType has 'goal' field.
        kras = frappe.get_all("KRA", filters={"goal": node_id}, fields=["name", "kra_name", "progress"])
        for kra in kras:
            children.append({
                "id": kra.name,
                "label": kra.kra_name,
                "type": "Department KRA",
                "expandable": True,
                "progress": kra.progress
            })

    elif node_type == "Department KRA":
        # Department KRA -> Linked Employees
        # Find Individual KRAs that have this Department KRA as parent
        ind_kras = frappe.get_all("KRA", filters={"parent_kra": node_id}, fields=["owner"])
        
        # Get Employees from owners
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
                "progress": 0 # TODO: Calculate employee progress on this KRA context
            })

    elif node_type == "Employee":
        # Employee -> Individual KPAs
        kpas = frappe.get_all("KPA Master", fields=["name", "kpa_name"])
        for kpa in kpas:
            children.append({
                "id": kpa.name,
                "label": kpa.kpa_name,
                "type": "Individual KPA",
                "expandable": True,
                "progress": 0 # TODO
            })

    elif node_type == "Individual KPA":
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
            
    elif node_type == "Individual Goal":
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

    elif node_type == "Individual KRA":
        # Individual KRA -> Individual KPIs
        # Find Scorecard Items linked to this KRA
        # We need to find the latest scorecard for this employee? 
        # Or just find KPIs that are generally linked. 
        # Scorecard Items are the link.
        # Let's search for Scorecard Items in active scorecards.
        items = frappe.db.sql("""
            SELECT item.kpi, item.score, item.actual, item.target
            FROM `tabScorecard Item` item
            JOIN `tabPerformance Scorecard` sc ON sc.name = item.parent
            WHERE item.kra = %s AND sc.docstatus = 0
            ORDER BY sc.modified DESC LIMIT 10
        """, (node_id,), as_dict=True)
        
        # Deduplicate by KPI
        seen_kpis = set()
        for item in items:
            if item.kpi not in seen_kpis:
                kpi_name = frappe.db.get_value("KPI Master", item.kpi, "kpi_name")
                children.append({
                    "id": item.kpi,
                    "label": kpi_name,
                    "type": "Individual KPI",
                    "expandable": False,
                    "progress": item.score # Score is essentially progress %
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
