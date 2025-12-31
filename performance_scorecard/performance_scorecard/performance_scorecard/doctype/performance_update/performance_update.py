import frappe
from frappe.model.document import Document
from performance_scorecard.performance_scorecard.scoring_engine import ScoringEngine

class PerformanceUpdate(Document):
	def on_update(self):
		self.update_scorecard()

	def on_submit(self):
		self.update_scorecard()

	def update_scorecard(self):
		if self.scorecard:
			scorecard = frappe.get_doc("Performance Scorecard", self.scorecard)
			# Find item with this KPI
			for item in scorecard.items:
				if item.kpi == self.kpi:
					if item.actual != self.actual_value:
						item.actual = self.actual_value
					break
			scorecard.overall_score = ScoringEngine.calculate_scorecard_score(scorecard)
			scorecard.save()
