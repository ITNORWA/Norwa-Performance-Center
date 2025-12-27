from frappe.model.document import Document

class PerformanceUpdate(Document):
	def on_submit(self):
		self.update_scorecard()

	def update_scorecard(self):
		if self.scorecard:
			scorecard = frappe.get_doc("Performance Scorecard", self.scorecard)
			# Find item with this KPI
			for item in scorecard.items:
				if item.kpi == self.kpi:
					item.actual = self.actual_value
					# Calculate score based on target
					if item.target:
						item.score = (item.actual / item.target) * 100 # Simple percentage for now
					break
			scorecard.save()
			scorecard.reload()
			scorecard.calculate_score()
			scorecard.save()
