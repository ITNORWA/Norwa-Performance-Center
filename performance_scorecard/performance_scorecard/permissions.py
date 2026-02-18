import frappe

def get_permission_query_conditions(user):
    if not user:
        user = frappe.session.user

    roles = frappe.get_roles(user)
    if "System Manager" in roles or "HR Manager" in roles or frappe.flags.in_migrate:
        return ""

    employee = frappe.db.get_value("Employee", {"user_id": user}, ["name", "company", "department"], as_dict=True)
    
    if not employee:
        # Fallback for non-employees
        return "1=0"

    conditions = []

    # 1. Company Match (Always required)
    # conditions.append(f"`company` = '{employee.company}'")

    if "Department Manager" in roles:
        # Dept Manager sees specific records:
        # - Owned by them
        # - Owned by their Dept
        # - Owned by employees in their Dept
        # - Shared Company goals
        conditions.append(f"""
            (`owner_type` = 'Employee' AND `employee` IN (SELECT `name` FROM `tabEmployee` WHERE `department` = '{employee.department}'))
            OR (`owner_type` = 'Department' AND `department` = '{employee.department}')
            OR (`owner_type` = 'Company' AND `company` = '{employee.company}')
        """)
    else:
        # Normal Employee sees:
        # - Their own records
        # - Department records (read-only usually, but query allows viewing)
        # - Company records
        conditions.append(f"""
            (`owner_type` = 'Employee' AND `employee` = '{employee.name}')
            OR (`owner_type` = 'Department' AND `department` = '{employee.department}')
            OR (`owner_type` = 'Company' AND `company` = '{employee.company}')
        """)

    return "(" + " OR ".join(conditions) + ")"

def has_permission(doc, user):
    if not user:
        user = frappe.session.user

    roles = frappe.get_roles(user)
    if "System Manager" in roles or "HR Manager" in roles:
        return True

    employee = frappe.db.get_value("Employee", {"user_id": user}, ["name", "company", "department"], as_dict=True)
    if not employee:
        return False

    # Check Company
    if doc.company != employee.company:
        return False

    if "Department Manager" in roles:
        if doc.owner_type == 'Company': return True
        if doc.owner_type == 'Department': return doc.department == employee.department
        if doc.owner_type == 'Employee':
            # Check if employee is in department
            if doc.employee == employee.name: return True
            emp_dept = frappe.db.get_value("Employee", doc.employee, "department")
            return emp_dept == employee.department

    else:
        # Normal Employee
        if doc.owner_type == 'Company': return True
        if doc.owner_type == 'Department': return doc.department == employee.department
        if doc.owner_type == 'Employee': return doc.employee == employee.name

    return False
