import frappe

ADMIN_ROLES = {"System Manager", "HR Manager"}


def get_goal_permission_query_conditions(user=None):
    return _get_permission_query_conditions("Goal Master", user)


def get_kra_permission_query_conditions(user=None):
    return _get_permission_query_conditions("KRA Master", user)


def get_kpi_permission_query_conditions(user=None):
    return _get_permission_query_conditions("KPI Master", user)


def get_kpa_permission_query_conditions(user=None):
    return _get_permission_query_conditions("KPA Master", user)


def _get_permission_query_conditions(doctype, user=None):
    if not user:
        user = frappe.session.user

    roles = set(frappe.get_roles(user))
    if ADMIN_ROLES.intersection(roles) or frappe.flags.in_migrate:
        return ""

    employee = _get_employee_context(user)
    if not employee:
        return "1=0"

    conditions = []
    company = _escape(employee.company)
    department = _escape(employee.department)
    employee_name = _escape(employee.name)
    is_department_manager = "Department Manager" in roles

    if company:
        conditions.append(f"(`company` = {company} OR `company` IS NULL)")

    if doctype == "Goal Master":
        employee_goal_condition = (
            f"`employee` IN (SELECT `name` FROM `tabEmployee` WHERE `department` = {department})"
            if is_department_manager and department
            else f"`employee` = {employee_name}"
        )
        goal_conditions = [
            "(`owner_type` = 'Company')",
            f"(`owner_type` = 'Employee' AND {employee_goal_condition})",
        ]
        if department:
            goal_conditions.append(f"(`owner_type` = 'Department' AND `department` = {department})")
        conditions.append("(" + " OR ".join(goal_conditions) + ")")
    elif doctype == "KRA Master":
        employee_kra_condition = (
            f"`employee` IN (SELECT `name` FROM `tabEmployee` WHERE `department` = {department})"
            if is_department_manager and department
            else f"`employee` = {employee_name}"
        )
        kra_conditions = [f"(`owner_type` = 'Employee' AND {employee_kra_condition})"]
        if department:
            kra_conditions.append(f"(`owner_type` = 'Department' AND `department` = {department})")
            kra_conditions.append(
                "(`goal` IN (SELECT `name` FROM `tabGoal Master` "
                f"WHERE `department` = {department} AND `owner_type` = 'Department'))"
            )
        conditions.append("(" + " OR ".join(kra_conditions) + ")")
    elif doctype == "KPI Master":
        if is_department_manager and department:
            conditions.append(
                "(`employee` IN (SELECT `name` FROM `tabEmployee` "
                f"WHERE `department` = {department}))"
            )
        else:
            conditions.append(f"(`employee` = {employee_name})")
    elif doctype == "KPA Master":
        if company:
            conditions.append(f"(`company` = {company})")

    if not conditions:
        return "1=0"

    return "(" + " AND ".join([f"({condition})" for condition in conditions]) + ")"


def _get_employee_context(user):
    return frappe.db.get_value(
        "Employee",
        {"user_id": user},
        ["name", "company", "department"],
        as_dict=True,
    )


def _escape(value):
    return frappe.db.escape(value) if value else None

def has_permission(doc, ptype='read', user=None):
    if not user:
        user = frappe.session.user

    roles = set(frappe.get_roles(user))
    if ADMIN_ROLES.intersection(roles):
        return True

    employee = _get_employee_context(user)
    if not employee:
        return False

    doc_company = getattr(doc, "company", None)
    if doc_company and employee.company and doc_company != employee.company:
        return False

    is_department_manager = "Department Manager" in roles

    if doc.doctype == "Goal Master":
        return _has_goal_permission(doc, ptype, employee, is_department_manager)
    if doc.doctype == "KRA Master":
        return _has_kra_permission(doc, ptype, employee, is_department_manager)
    if doc.doctype == "KPI Master":
        return _has_kpi_permission(doc, ptype, employee, is_department_manager)
    if doc.doctype == "KPA Master":
        return ptype == "read"

    return False


def _has_goal_permission(doc, ptype, employee, is_department_manager):
    if doc.owner_type == "Company":
        return ptype == "read"
    if doc.owner_type == "Department":
        if doc.department != employee.department:
            return False
        return True if is_department_manager else ptype == "read"
    if doc.owner_type == "Employee":
        if doc.employee == employee.name:
            return True
        if not is_department_manager:
            return False
        employee_department = frappe.db.get_value("Employee", doc.employee, "department")
        return employee_department == employee.department
    return False


def _has_kra_permission(doc, ptype, employee, is_department_manager):
    if doc.owner_type == "Department":
        if doc.department == employee.department:
            return True if is_department_manager else ptype == "read"
        goal_department = frappe.db.get_value("Goal Master", doc.goal, "department") if doc.goal else None
        if goal_department == employee.department:
            return True if is_department_manager else ptype == "read"
        return False
    if doc.owner_type == "Employee":
        if doc.employee == employee.name:
            return True
        if not is_department_manager:
            return False
        employee_department = frappe.db.get_value("Employee", doc.employee, "department")
        return employee_department == employee.department
    return False


def _has_kpi_permission(doc, ptype, employee, is_department_manager):
    if doc.employee == employee.name:
        return True
    if not is_department_manager:
        return False
    employee_department = frappe.db.get_value("Employee", doc.employee, "department")
    return employee_department == employee.department
