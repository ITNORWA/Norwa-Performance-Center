import frappe
from frappe.model.document import Document
from frappe.utils import flt

from performance_scorecard.performance_scorecard.doctype.weekly_commitment.weekly_commitment import get_kpi_commitment_total
from performance_scorecard.performance_scorecard.scoring_engine import ScoringEngine

class PerformanceUpdate(Document):
	def on_update(self):
		self.update_scorecard()

	def validate(self):
		if not self.company and self.scorecard:
			self.company = frappe.db.get_value("Performance Scorecard", self.scorecard, "company")
		if not self.company and self.kpi:
			self.company = frappe.db.get_value("KPI Master", self.kpi, "company")

	def on_submit(self):
		self.update_scorecard()

	def update_scorecard(self):
		if self.scorecard:
			scorecard = frappe.get_doc("Performance Scorecard", self.scorecard)
			commitment_total = get_kpi_commitment_total(scorecard.employee, self.kpi)
			base_actual = flt(self.actual_value)
			combined_actual = base_actual + commitment_total
			# Find item with this KPI
			for item in scorecard.items:
				if item.kpi == self.kpi:
					item.base_actual = base_actual
					if item.actual != combined_actual:
						item.actual = combined_actual
					break
			scorecard.overall_score = ScoringEngine.calculate_scorecard_score(scorecard)
			scorecard.save()
