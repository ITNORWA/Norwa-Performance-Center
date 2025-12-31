import frappe
from frappe.model.document import Document

class KRA(Document):
	def validate(self):
		self.validate_goal_link()

	def validate_goal_link(self):
		if not self.goal:
			frappe.throw("KRA must be linked to a goal.")

		goal = frappe.get_doc("Goal", self.goal)
		if goal.owner_type == "Company":
			frappe.throw("Company goals cannot have KRAs.")

		if self.parent_kra:
			parent = frappe.get_doc("KRA", self.parent_kra)
			parent_goal = frappe.get_doc("Goal", parent.goal) if parent.goal else None

			if goal.owner_type != "Employee":
				frappe.throw("Parent KRA can only be set for employee goals.")
			if not parent_goal or parent_goal.owner_type != "Department":
				frappe.throw("Parent KRA must belong to a department goal.")
			if goal.parent_goal and parent.goal != goal.parent_goal:
				frappe.throw("Parent KRA must belong to the parent department goal.")
