import frappe
from frappe.utils import flt


class ScoringEngine:
    @staticmethod
    def calculate_scorecard_score(scorecard_doc):
        """
        Calculates the overall score for a Performance Scorecard based on its items.
        Also triggers the cascading update for linked KRAs and Goals.
        """
        total_weight = 0
        total_score = 0

        for item in scorecard_doc.items:
            weight = flt(item.weightage)
            score = flt(item.score)
            total_score += (score * weight)
            total_weight += weight

            if item.kra:
                ScoringEngine.update_kra_progress(item.kra)

        overall_score = (total_score / total_weight) if total_weight > 0 else 0
        return overall_score

    @staticmethod
    def update_kra_progress(kra_name, visited=None, depth=0):
        """
        Calculates KRA progress based on linked KPIs (Scorecard Items) or Child KRAs.
        """
        if not kra_name:
            return

        if visited is None:
            visited = set()

        if kra_name in visited or depth > 20:
            return

        visited.add(kra_name)

        kra_doc = frappe.get_doc("KRA", kra_name)

        linked_kpis = frappe.db.sql(
            """
            SELECT AVG(score) as avg_score
            FROM `tabScorecard Item`
            WHERE kra = %s AND docstatus = 0
        """,
            (kra_name,),
            as_dict=True,
        )

        kpi_progress = (
            flt(linked_kpis[0].avg_score)
            if linked_kpis and linked_kpis[0].avg_score is not None
            else 0
        )

        child_kras = frappe.get_all(
            "KRA", filters={"parent_kra": kra_name}, fields=["progress", "weightage"]
        )

        if child_kras:
            total_child_progress = sum([flt(k.progress) for k in child_kras])
            kra_progress = total_child_progress / len(child_kras)
        else:
            kra_progress = kpi_progress

        frappe.db.set_value("KRA", kra_name, "progress", kra_progress)

        if kra_doc.goal:
            ScoringEngine.update_goal_progress(kra_doc.goal)

        if kra_doc.parent_kra:
            ScoringEngine.update_kra_progress(kra_doc.parent_kra, visited, depth + 1)

    @staticmethod
    def update_goal_progress(goal_name, visited=None, depth=0):
        """
        Calculates Goal progress based on linked KRAs or Child Goals.
        """
        if not goal_name:
            return

        if visited is None:
            visited = set()

        if goal_name in visited or depth > 20:
            return

        visited.add(goal_name)

        goal_doc = frappe.get_doc("Goal", goal_name)

        linked_kras = frappe.get_all(
            "KRA", filters={"goal": goal_name}, fields=["progress", "weightage"]
        )

        if linked_kras:
            total_weight = sum([flt(k.weightage) for k in linked_kras])
            total_progress = sum([flt(k.progress) * flt(k.weightage) for k in linked_kras])
            goal_progress_from_kras = (total_progress / total_weight) if total_weight > 0 else 0
        else:
            goal_progress_from_kras = 0

        child_goals = frappe.get_all("Goal", filters={"parent_goal": goal_name}, fields=["progress"])

        if child_goals:
            total_child_progress = sum([flt(g.progress) for g in child_goals])
            goal_progress = total_child_progress / len(child_goals)
        else:
            goal_progress = goal_progress_from_kras

        frappe.db.set_value("Goal", goal_name, "progress", goal_progress)

        if goal_doc.parent_goal:
            ScoringEngine.update_goal_progress(goal_doc.parent_goal, visited, depth + 1)

        if goal_doc.parent_kpa:
            ScoringEngine.update_kpa_progress(goal_doc.parent_kpa)

    @staticmethod
    def update_kpa_progress(kpa_name):
        """
        Calculates KPA progress based on linked Goals.
        """
        pass
