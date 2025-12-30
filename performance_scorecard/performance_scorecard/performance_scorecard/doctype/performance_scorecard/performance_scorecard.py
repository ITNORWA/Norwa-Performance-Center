from frappe.model.document import Document
from performance_scorecard.performance_scorecard.scoring_engine import ScoringEngine

class PerformanceScorecard(Document):
	def validate(self):
		self.calculate_score()

	def calculate_score(self):
		self.overall_score = ScoringEngine.calculate_scorecard_score(self)
