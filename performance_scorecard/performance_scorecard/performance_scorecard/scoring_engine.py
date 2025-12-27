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
            
            # Trigger cascading update for the linked KRA
            if item.kra:
                ScoringEngine.update_kra_progress(item.kra)

        overall_score = (total_score / total_weight) if total_weight > 0 else 0
        return overall_score

    @staticmethod
    def update_kra_progress(kra_name):
        """
        Calculates KRA progress based on linked KPIs (Scorecard Items) or Child KRAs.
        """
        kra_doc = frappe.get_doc("KRA", kra_name)
        
        # 1. Check if this KRA has linked KPIs (Scorecard Items)
        # We need to find all Scorecard Items that link to this KRA
        # This is tricky because Scorecard Items are child tables.
        # We can query the Scorecard Item table directly.
        
        linked_kpis = frappe.db.sql("""
            SELECT AVG(score) as avg_score
            FROM `tabScorecard Item`
            WHERE kra = %s AND docstatus = 0
        """, (kra_name,), as_dict=True)
        
        kpi_progress = flt(linked_kpis[0].avg_score) if linked_kpis and linked_kpis[0].avg_score is not None else 0
        
        # 2. Check if this KRA has Child KRAs (e.g., Dept KRA having Individual KRAs)
        child_kras = frappe.get_all("KRA", filters={"parent_kra": kra_name}, fields=["progress", "weightage"])
        
        if child_kras:
            # If it has child KRAs, its progress is the average of child KRAs
            # (Simple average or weighted? User said "individual KRAs affect the departmental linked KRAs")
            # Let's assume simple average for now unless weights are defined for children relative to parent
            total_child_progress = sum([flt(k.progress) for k in child_kras])
            kra_progress = total_child_progress / len(child_kras)
        else:
            # If no child KRAs, use the KPI progress
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
        
        # 1. Calculate progress from linked KRAs
        linked_kras = frappe.get_all("KRA", filters={"goal": goal_name}, fields=["progress", "weightage"])
        
        if linked_kras:
            # Weighted average of KRAs? Or simple? 
            # User said "Goal constitutes of multiple KRAs". Usually weighted.
            total_weight = sum([flt(k.weightage) for k in linked_kras])
            total_progress = sum([flt(k.progress) * flt(k.weightage) for k in linked_kras])
            
            goal_progress_from_kras = (total_progress / total_weight) if total_weight > 0 else 0
        else:
            goal_progress_from_kras = 0
            
        # 2. Check for Child Goals (e.g., Company Goal having Dept Goals)
        child_goals = frappe.get_all("Goal", filters={"parent_goal": goal_name}, fields=["progress"])
        
        if child_goals:
            # If it has child goals, its progress is the average of child goals
            total_child_progress = sum([flt(g.progress) for g in child_goals])
            goal_progress = total_child_progress / len(child_goals)
        else:
            # If no child goals, use the KRA progress
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
        # KPA progress is the average of all linked Goals (at that level? or all?)
        # User said: "The company KPA is calculated by the average of the company goals"
        # "The department goals... gives you the progress of the KPA of that department"
        # So KPA progress is context-dependent? 
        # Actually, KPA Master might just hold a generic color/name. 
        # But if we want to show "Finance KPA Progress", we need to know WHICH goals.
        # Let's calculate the global average for the KPA based on ALL linked goals for now, 
        # or we might need to store KPA progress on the Goal/Department level dynamically.
        # For now, let's just update the KPA Master with a global progress if needed, 
        # but usually KPA progress is calculated on the fly for dashboards.
        pass
