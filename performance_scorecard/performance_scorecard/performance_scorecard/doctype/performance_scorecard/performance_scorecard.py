from frappe.model.document import Document
import frappe

class PerformanceScorecard(Document):
	def validate(self):
		self.calculate_score()

	def calculate_score(self):
		# 1. Group items by KPA -> Goal -> KRA
		hierarchy = {}
		for item in self.items:
			if not item.kpa or not item.goal or not item.kra or not item.kpi:
				continue
			
			if item.kpa not in hierarchy:
				hierarchy[item.kpa] = {"goals": {}, "weight": frappe.get_value("KPA Master", item.kpa, "weightage") or 0}
			
			if item.goal not in hierarchy[item.kpa]["goals"]:
				hierarchy[item.kpa]["goals"][item.goal] = {"kras": {}, "weight": frappe.get_value("Goal", item.goal, "weightage") or 0}
			
			if item.kra not in hierarchy[item.kpa]["goals"][item.goal]["kras"]:
				hierarchy[item.kpa]["goals"][item.goal]["kras"][item.kra] = {"items": [], "weight": frappe.get_value("KRA", item.kra, "weightage") or 0}
			
			hierarchy[item.kpa]["goals"][item.goal]["kras"][item.kra]["items"].append(item)

		# 2. Calculate scores bottom-up
		total_score = 0
		total_kpa_weight = 0

		for kpa, kpa_data in hierarchy.items():
			kpa_score = 0
			total_goal_weight = 0
			
			for goal, goal_data in kpa_data["goals"].items():
				goal_score = 0
				total_kra_weight = 0
				
				for kra, kra_data in goal_data["kras"].items():
					kra_score = 0
					total_kpi_weight = 0
					
					for item in kra_data["items"]:
						# Calculate item score
						if item.target and item.actual is not None:
							# Basic percentage calculation
							item.score = (item.actual / item.target) * 100
						else:
							item.score = 0
						
						kra_score += item.score * (item.weightage / 100.0)
						total_kpi_weight += item.weightage
					
					# Normalize KRA score if weights don't sum to 100
					if total_kpi_weight > 0:
						kra_score = (kra_score / total_kpi_weight) * 100
					
					goal_score += kra_score * (kra_data["weight"] / 100.0)
					total_kra_weight += kra_data["weight"]
				
				if total_kra_weight > 0:
					goal_score = (goal_score / total_kra_weight) * 100
				
				kpa_score += goal_score * (goal_data["weight"] / 100.0)
				total_goal_weight += goal_data["weight"]
			
			if total_goal_weight > 0:
				kpa_score = (kpa_score / total_goal_weight) * 100
			
			total_score += kpa_score * (kpa_data["weight"] / 100.0)
			total_kpa_weight += kpa_data["weight"]

		if total_kpa_weight > 0:
			self.overall_score = (total_score / total_kpa_weight) * 100
		else:
			self.overall_score = 0
