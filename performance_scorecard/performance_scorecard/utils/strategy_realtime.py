import frappe

from performance_scorecard.performance_scorecard.utils.scorecard_sync import (
    sync_scorecards_for_goal,
    sync_scorecards_for_kpi,
    sync_scorecards_for_kra,
)


def publish_strategy_refresh(level=None, employee=None, department=None):
    frappe.publish_realtime(
        "strategy_plans_refresh",
        {"level": level, "employee": employee, "department": department},
    )


def publish_from_goal(doc, method=None):
    from performance_scorecard.performance_scorecard.scoring_engine import ScoringEngine
    if method != "on_trash":
        sync_scorecards_for_goal(doc.name)
    if doc.kpa:
        ScoringEngine.update_kpa_progress(doc.kpa)
    elif doc.parent_goal:
        ScoringEngine.update_goal_progress(doc.parent_goal)

    level = _level_from_owner(doc.owner_type)
    publish_strategy_refresh(level=level, employee=doc.employee, department=doc.department)


def publish_from_kra(doc, method=None):
    from performance_scorecard.performance_scorecard.scoring_engine import ScoringEngine
    if method != "on_trash":
        sync_scorecards_for_kra(doc.name)
    if doc.goal:
        ScoringEngine.update_goal_progress(doc.goal)
    elif doc.parent_kra:
        ScoringEngine.update_kra_progress(doc.parent_kra)

    goal_name = getattr(doc, "goal", None)
    if not goal_name:
        publish_strategy_refresh()
        return

    goal = frappe.db.get_value(
        "Goal Master",
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
    from performance_scorecard.performance_scorecard.scoring_engine import ScoringEngine
    previous_employee = None
    if method == "on_update":
        previous = doc.get_doc_before_save()
        previous_employee = previous.employee if previous else None
    if method != "on_trash":
        sync_scorecards_for_kpi(doc.name, previous_employee=previous_employee, force_recalculate=True)
    if doc.kra:
        ScoringEngine.update_kra_progress(doc.kra)

    kra_name = getattr(doc, "kra", None)
    if not kra_name:
        publish_strategy_refresh(level="Individual")
        return

    goal_name = frappe.db.get_value("KRA Master", kra_name, "goal")
    if not goal_name:
        publish_strategy_refresh(level="Individual")
        return

    goal = frappe.db.get_value(
        "Goal Master",
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



def publish_from_commitment(doc, method=None):
    from performance_scorecard.performance_scorecard.scoring_engine import ScoringEngine
    # Recalculate KPI score if linked
    if doc.kpi and doc.docstatus == 1: # Only on Submit
        # We need to find the Scorecard Item for this KPI and update it
        # Actually, best to trigger a KPI-level update
        pass

    publish_strategy_refresh(level="Individual", employee=doc.employee)

def _level_from_owner(owner_type):
    if owner_type == "Company":
        return "Company"
    if owner_type == "Department":
        return "Department"
    return "Individual"
