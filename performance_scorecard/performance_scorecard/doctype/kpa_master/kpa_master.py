from frappe.model.document import Document

from performance_scorecard.performance_scorecard.utils.weightage import (
	validate_weightage_allocation,
)


class KPAMaster(Document):
	def validate(self):
		validate_weightage_allocation(
			"KPA Master",
			{"company": self.company},
			self.weightage,
			current_name=self.name,
			context_label=f"KPAs for company {self.company}",
		)
