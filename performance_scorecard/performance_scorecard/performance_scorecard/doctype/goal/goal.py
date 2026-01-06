import frappe
from frappe.model.document import Document

class Goal(Document):
	def validate(self):
		self.validate_hierarchy()

	def validate_hierarchy(self):
		if self.parent_goal:
			parent = frappe.get_doc("Goal", self.parent_goal)
			if self.owner_type == "Employee" and parent.owner_type == "Employee":
				# Employee goal can have another employee goal as parent (e.g. manager)
				pass
			elif self.owner_type == "Employee" and parent.owner_type != "Department":
				# Ideally Employee goal should roll up to Department goal
				pass
			# Add more validation logic as needed
