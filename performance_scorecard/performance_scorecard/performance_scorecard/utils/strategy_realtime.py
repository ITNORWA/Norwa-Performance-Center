import frappe


def publish_strategy_refresh(level=None, employee=None, department=None):
    frappe.publish_realtime(
        "strategy_plans_refresh",
        {"level": level, "employee": employee, "department": department},
    )


def publish_from_goal(doc, method=None):
    level = _level_from_owner(doc.owner_type)
    publish_strategy_refresh(level=level, employee=doc.employee, department=doc.department)


def publish_from_kra(doc, method=None):
    goal_name = getattr(doc, "goal", None)
    if not goal_name:
        publish_strategy_refresh()
        return

    goal = frappe.db.get_value(
        "Goal",
        goal_name,
        ["owner_type", "employee", "department"],
        as_dict=True,
    )
    if not goal:
        publish_strategy_refresh()
        return

    level = _level_from_owner(goal.owner_type)
    publish_strategy_refresh(level=level, employee=goal.employee, department=goal.department)


def publish_from_kpi(doc, method=None):
    kra_name = getattr(doc, "kra", None)
    if not kra_name:
        publish_strategy_refresh(level="Individual")
        return

    goal_name = frappe.db.get_value("KRA", kra_name, "goal")
    if not goal_name:
        publish_strategy_refresh(level="Individual")
        return

    goal = frappe.db.get_value(
        "Goal",
        goal_name,
        ["owner_type", "employee", "department"],
        as_dict=True,
    )
    level = _level_from_owner(goal.owner_type) if goal else "Individual"
    employee = goal.employee if goal else None
    department = goal.department if goal else None
    publish_strategy_refresh(level=level, employee=employee, department=department)


def publish_from_scorecard(doc, method=None):
    publish_strategy_refresh(level="Individual", employee=doc.employee, department=doc.department)


def publish_from_update(doc, method=None):
    scorecard = frappe.db.get_value(
        "Performance Scorecard",
        doc.scorecard,
        ["employee", "department"],
        as_dict=True,
    )
    publish_strategy_refresh(level="Individual", employee=(scorecard or {}).get("employee"), department=(scorecard or {}).get("department"))


def _level_from_owner(owner_type):
    if owner_type == "Company":
        return "Company"
    if owner_type == "Department":
        return "Department"
    return "Individual"
