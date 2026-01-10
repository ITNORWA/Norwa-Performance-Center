import frappe
from frappe.utils import flt

class ScoringEngine:
    @staticmethod
    def get_settings():
        return frappe.get_single("Performance Settings")

    @staticmethod
    def calculate_scorecard_score(scorecard_doc):
        """
        Calculates the overall score for a Performance Scorecard based on its items.
        Also triggers the cascading update for linked KRAs and Goals.
        """
        settings = ScoringEngine.get_settings()
        method = settings.calculation_method or "Weighted Average"
        
        total_weight = 0
        total_score = 0
        count = 0
        
        for item in scorecard_doc.items:
            weight = flt(item.weightage)
            score = flt(item.score)
            
            if method == "Weighted Average":
                total_score += (score * weight)
                total_weight += weight
            else:
                total_score += score
                count += 1
            
            # Trigger cascading update for the linked KRA
            if item.kra:
                ScoringEngine.update_kra_progress(item.kra)

        if method == "Weighted Average":
            overall_score = (total_score / total_weight) if total_weight > 0 else 0
        else:
            overall_score = (total_score / count) if count > 0 else 0
            
        return overall_score

    @staticmethod
    def update_kra_progress(kra_name):
        """
        Calculates KRA progress based on linked KPIs (Scorecard Items) or Child KRAs.
        """
        kra_doc = frappe.get_doc("KRA", kra_name)
        settings = ScoringEngine.get_settings()
        method = settings.calculation_method or "Weighted Average"
        
        # 1. Check if this KRA has linked KPIs (Scorecard Items)
        linked_kpis = frappe.db.sql("""
            SELECT score, weightage
            FROM `tabScorecard Item`
            WHERE kra = %s AND docstatus = 0
        """, (kra_name,), as_dict=True)
        
        kpi_progress = 0
        if linked_kpis:
            if method == "Weighted Average":
                total_w = sum([flt(k.weightage) for k in linked_kpis])
                total_s = sum([flt(k.score) * flt(k.weightage) for k in linked_kpis])
                kpi_progress = (total_s / total_w) if total_w > 0 else 0
            else:
                kpi_progress = sum([flt(k.score) for k in linked_kpis]) / len(linked_kpis)
        
        # 2. Check if this KRA has Child KRAs
        child_kras = frappe.get_all("KRA", filters={"parent_kra": kra_name}, fields=["progress", "weightage"])
        
        if child_kras:
            if method == "Weighted Average":
                total_w = sum([flt(k.weightage) for k in child_kras])
                total_p = sum([flt(k.progress) * flt(k.weightage) for k in child_kras])
                kra_progress = (total_p / total_w) if total_w > 0 else 0
            else:
                kra_progress = sum([flt(k.progress) for k in child_kras]) / len(child_kras)
        else:
            kra_progress = kpi_progress

        # Update KRA Progress
        frappe.db.set_value("KRA", kra_name, "progress", kra_progress)
        
        # Trigger cascading update for the linked Goal
        if kra_doc.goal:
            ScoringEngine.update_goal_progress(kra_doc.goal)
            
        # Trigger cascading update for Parent KRA (if any)
        if kra_doc.parent_kra:
            ScoringEngine.update_kra_progress(kra_doc.parent_kra)

    @staticmethod
    def update_goal_progress(goal_name):
        """
        Calculates Goal progress based on linked KRAs or Child Goals.
        """
        goal_doc = frappe.get_doc("Goal", goal_name)
        settings = ScoringEngine.get_settings()
        method = settings.calculation_method or "Weighted Average"
        
        # 1. Calculate progress from linked KRAs
        linked_kras = frappe.get_all("KRA", filters={"goal": goal_name}, fields=["progress", "weightage"])
        
        goal_progress_from_kras = 0
        if linked_kras:
            if method == "Weighted Average":
                total_weight = sum([flt(k.weightage) for k in linked_kras])
                total_progress = sum([flt(k.progress) * flt(k.weightage) for k in linked_kras])
                goal_progress_from_kras = (total_progress / total_weight) if total_weight > 0 else 0
            else:
                goal_progress_from_kras = sum([flt(k.progress) for k in linked_kras]) / len(linked_kras)
            
        # 2. Check for Child Goals
        child_goals = frappe.get_all("Goal", filters={"parent_goal": goal_name}, fields=["progress", "weightage"])
        
        if child_goals:
            if method == "Weighted Average":
                total_w = sum([flt(g.weightage) for g in child_goals])
                total_p = sum([flt(g.progress) * flt(g.weightage) for g in child_goals])
                goal_progress = (total_p / total_w) if total_w > 0 else 0
            else:
                goal_progress = sum([flt(g.progress) for g in child_goals]) / len(child_goals)
        else:
            goal_progress = goal_progress_from_kras
            
        # Update Goal Progress
        frappe.db.set_value("Goal", goal_name, "progress", goal_progress)
        
        # Trigger cascading update for Parent Goal (if any)
        if goal_doc.parent_goal:
            ScoringEngine.update_goal_progress(goal_doc.parent_goal)
            
        # Trigger cascading update for linked KPA
        if goal_doc.parent_kpa:
            ScoringEngine.update_kpa_progress(goal_doc.parent_kpa)

    @staticmethod
    def update_kpa_progress(kpa_name):
        """
        Calculates KPA progress based on linked Goals.
        """
        pass
