import frappe
from frappe.utils import flt

class ScoringEngine:
    @staticmethod
    def get_kpi_meta(kpi_name, cache=None):
        if not kpi_name:
            return {}
        if cache is not None and kpi_name in cache:
            return cache[kpi_name]
        meta = frappe.db.get_value(
            "KPI Master",
            kpi_name,
            ["direction", "baseline"],
            as_dict=True,
        ) or {}
        if cache is not None:
            cache[kpi_name] = meta
        return meta

    @staticmethod
    def calculate_kpi_score(kpi_name, actual, target, cache=None):
        meta = ScoringEngine.get_kpi_meta(kpi_name, cache=cache)
        direction = (meta.get("direction") or "Increase").lower()
        actual_value = flt(actual or 0)
        target_value = flt(target or 0)

        if direction == "decrease":
            baseline = meta.get("baseline")
            if baseline is None:
                return 0
            baseline_value = flt(baseline)
            if baseline_value == target_value:
                return 0
            return ((baseline_value - actual_value) / (baseline_value - target_value)) * 100

        return (actual_value / target_value) * 100 if target_value else 0

    @staticmethod
    def get_settings():
        if frappe.db.exists("DocType", "Performance Settings"):
            return frappe.get_single("Performance Settings")
        return frappe._dict({"calculation_method": "Weighted Average"})

    @staticmethod
    def calculate_scorecard_score(scorecard_doc):
        """
        Calculates the overall score for a Performance Scorecard based on its items.
        Also triggers the cascading update for linked KRAs and Goals.
        """
        settings = ScoringEngine.get_settings()
        method = settings.calculation_method or "Weighted Average"
        use_weighted = method == "Weighted Average"

        # 1. Group items by KPA -> Goal -> KRA
        hierarchy = {}
        kra_updates = set()

        kpi_cache = {}
        for item in scorecard_doc.items:
            if not item.kpa or not item.goal or not item.kra or not item.kpi:
                continue

            if item.target is not None and item.actual is not None:
                item.score = ScoringEngine.calculate_kpi_score(
                    item.kpi,
                    item.actual,
                    item.target,
                    cache=kpi_cache,
                )
            else:
                item.score = 0

            if item.kpa not in hierarchy:
                hierarchy[item.kpa] = {
                    "goals": {},
                    "weight": 0,
                }
                if use_weighted:
                    hierarchy[item.kpa]["weight"] = flt(
                        frappe.get_value("KPA Master", item.kpa, "weightage") or 0
                    )

            if item.goal not in hierarchy[item.kpa]["goals"]:
                hierarchy[item.kpa]["goals"][item.goal] = {
                    "kras": {},
                    "weight": 0,
                }
                if use_weighted:
                    hierarchy[item.kpa]["goals"][item.goal]["weight"] = flt(
                        frappe.get_value("Goal Master", item.goal, "weightage") or 0
                    )

            if item.kra not in hierarchy[item.kpa]["goals"][item.goal]["kras"]:
                hierarchy[item.kpa]["goals"][item.goal]["kras"][item.kra] = {
                    "items": [],
                    "weight": 0,
                }
                if use_weighted:
                    hierarchy[item.kpa]["goals"][item.goal]["kras"][item.kra]["weight"] = flt(
                        frappe.get_value("KRA Master", item.kra, "weightage") or 0
                    )

            hierarchy[item.kpa]["goals"][item.goal]["kras"][item.kra]["items"].append(item)
            kra_updates.add(item.kra)

        # 2. Calculate scores bottom-up
        if method == "Simple Average":
            kpa_scores = []
            for _, kpa_data in hierarchy.items():
                goal_scores = []
                for _, goal_data in kpa_data["goals"].items():
                    kra_scores = []
                    for _, kra_data in goal_data["kras"].items():
                        kpi_scores = [flt(item.score) for item in kra_data["items"]]
                        kra_score = sum(kpi_scores) / len(kpi_scores) if kpi_scores else 0
                        kra_scores.append(kra_score)
                    goal_score = sum(kra_scores) / len(kra_scores) if kra_scores else 0
                    goal_scores.append(goal_score)
                kpa_score = sum(goal_scores) / len(goal_scores) if goal_scores else 0
                kpa_scores.append(kpa_score)
            overall_score = sum(kpa_scores) / len(kpa_scores) if kpa_scores else 0
        else:
            total_score = 0
            total_kpa_weight = 0

            for _, kpa_data in hierarchy.items():
                kpa_score = 0
                total_goal_weight = 0

                for _, goal_data in kpa_data["goals"].items():
                    goal_score = 0
                    total_kra_weight = 0

                    for _, kra_data in goal_data["kras"].items():
                        kra_score = 0
                        total_kpi_weight = 0

                        for item in kra_data["items"]:
                            weight = flt(item.weightage) / 100.0 if item.weightage else 0
                            kra_score += flt(item.score) * weight
                            total_kpi_weight += flt(item.weightage)

                        if total_kpi_weight > 0:
                            kra_score = (kra_score / total_kpi_weight) * 100

                        goal_score += kra_score * (kra_data["weight"] / 100.0 if kra_data["weight"] else 0)
                        total_kra_weight += kra_data["weight"]

                    if total_kra_weight > 0:
                        goal_score = (goal_score / total_kra_weight) * 100

                    goal_score_weight = goal_data["weight"] / 100.0 if goal_data["weight"] else 0
                    kpa_score += goal_score * goal_score_weight
                    total_goal_weight += goal_data["weight"]

                if total_goal_weight > 0:
                    kpa_score = (kpa_score / total_goal_weight) * 100

                kpa_score_weight = kpa_data["weight"] / 100.0 if kpa_data["weight"] else 0
                total_score += kpa_score * kpa_score_weight
                total_kpa_weight += kpa_data["weight"]

            overall_score = (total_score / total_kpa_weight) * 100 if total_kpa_weight > 0 else 0
        scorecard_doc.overall_score = overall_score

        for kra_name in sorted(kra_updates):
            ScoringEngine.update_kra_progress(kra_name)

        return overall_score

    @staticmethod
    def update_kra_progress(kra_name, visited=None):
        """
        Calculates KRA progress based on linked KPIs (Scorecard Items) or Child KRAs.
        """
        if not kra_name:
            return
        if visited is None:
            visited = set()
        if kra_name in visited:
            return
        visited.add(kra_name)

        kra_doc = frappe.get_doc("KRA Master", kra_name)
        settings = ScoringEngine.get_settings()
        method = settings.calculation_method or "Weighted Average"
        
        # 1. Check if this KRA has linked KPIs (Scorecard Items)
        linked_kpis = frappe.db.sql("""
            SELECT score, weightage
            FROM `tabScorecard Item`
            WHERE kra = %s AND docstatus < 2
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
        child_kras = frappe.get_all("KRA Master", filters={"parent_kra": kra_name}, fields=["progress", "weightage"])
        
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
        frappe.db.set_value("KRA Master", kra_name, "progress", kra_progress)
        
        # Trigger cascading update for the linked Goal
        if kra_doc.goal:
            ScoringEngine.update_goal_progress(kra_doc.goal)
            
        # Trigger cascading update for Parent KRA (if any)
        if kra_doc.parent_kra:
            ScoringEngine.update_kra_progress(kra_doc.parent_kra, visited)

    @staticmethod
    def update_goal_progress(goal_name, visited=None):
        """
        Calculates Goal progress based on linked KRAs or Child Goals.
        """
        if not goal_name:
            return
        if visited is None:
            visited = set()
        if goal_name in visited:
            return
        visited.add(goal_name)

        goal_doc = frappe.get_doc("Goal Master", goal_name)
        settings = ScoringEngine.get_settings()
        method = settings.calculation_method or "Weighted Average"
        
        # 1. Calculate progress from linked KRAs
        linked_kras = frappe.get_all("KRA Master", filters={"goal": goal_name}, fields=["progress", "weightage"])
        
        goal_progress_from_kras = 0
        if linked_kras:
            if method == "Weighted Average":
                total_weight = sum([flt(k.weightage) for k in linked_kras])
                total_progress = sum([flt(k.progress) * flt(k.weightage) for k in linked_kras])
                goal_progress_from_kras = (total_progress / total_weight) if total_weight > 0 else 0
            else:
                goal_progress_from_kras = sum([flt(k.progress) for k in linked_kras]) / len(linked_kras)
            
        # 2. Check for Child Goals
        child_goals = frappe.get_all("Goal Master", filters={"parent_goal": goal_name}, fields=["progress", "weightage"])
        
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
        frappe.db.set_value("Goal Master", goal_name, "progress", goal_progress)
        
        # Trigger cascading update for Parent Goal (if any)
        if goal_doc.parent_goal:
            ScoringEngine.update_goal_progress(goal_doc.parent_goal, visited)
            
        # Trigger cascading update for linked KPA
        if goal_doc.kpa:
            ScoringEngine.update_kpa_progress(goal_doc.kpa)

    @staticmethod
    def update_kpa_progress(kpa_name):
        """
        Calculates KPA progress based on linked Goals.
        """
        settings = ScoringEngine.get_settings()
        method = settings.calculation_method or "Weighted Average"

        linked_goals = frappe.get_all("Goal Master", filters={"kpa": kpa_name}, fields=["progress", "weightage"])

        kpa_progress = 0
        if linked_goals:
            if method == "Weighted Average":
                total_w = sum(flt(g.weightage) for g in linked_goals)
                total_p = sum(flt(g.progress) * flt(g.weightage) for g in linked_goals)
                kpa_progress = (total_p / total_w) if total_w > 0 else 0
            else:
                kpa_progress = sum(flt(g.progress) for g in linked_goals) / len(linked_goals)

        frappe.db.set_value("KPA Master", kpa_name, "progress", kpa_progress)
        return kpa_progress
