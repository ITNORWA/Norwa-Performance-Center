import frappe
from frappe.model.document import Document
from performance_scorecard.performance_scorecard.scoring_engine import ScoringEngine

class PerformanceScorecard(Document):
	def validate(self):
		self.set_department()
		self.populate_items_from_kpis()
		self.calculate_score()

	def calculate_score(self):
		self.overall_score = ScoringEngine.calculate_scorecard_score(self)

	def set_department(self):
		if self.employee and not self.department:
			self.department = frappe.db.get_value("Employee", self.employee, "department")

	def populate_items_from_kpis(self):
		if self.items or not self.employee:
			return

		goals = frappe.get_all(
			"Goal",
			filters={"owner_type": "Employee", "employee": self.employee},
			fields=["name", "kpa"],
		)
		if not goals:
			return

		goal_map = {g.name: g for g in goals}
		kras = frappe.get_all(
			"KRA",
			filters={"goal": ["in", list(goal_map.keys())]},
			fields=["name", "goal"],
		)
		if not kras:
			return

		kra_map = {k.name: k.goal for k in kras}
		kpis = frappe.get_all(
			"KPI Master",
			filters={
				"kra": ["in", list(kra_map.keys())],
				"employee": self.employee,
			},
			fields=["name", "kra"],
		)
		if not kpis:
			return

		for kpi in kpis:
			goal_name = kra_map.get(kpi.kra)
			goal_row = goal_map.get(goal_name)
			self.append(
				"items",
				{
					"kpa": (goal_row.kpa if goal_row else None),
					"goal": goal_name,
					"kra": kpi.kra,
					"kpi": kpi.name,
					"weightage": 0,
				},
			)
