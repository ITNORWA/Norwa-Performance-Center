import frappe
from frappe.model.document import Document

from performance_scorecard.performance_scorecard.utils.department_hierarchy import (
	is_same_or_ancestor_department,
)
from performance_scorecard.performance_scorecard.utils.weightage import (
	validate_weightage_allocation,
)

class KRAMaster(Document):
	def validate(self):
		self.validate_goal_link()
		self.validate_weightage()

	def validate_goal_link(self):
		if not self.goal:
			frappe.throw("KRA must be linked to a goal.")

		self.goal = self.goal.strip()
		if not frappe.db.exists("Goal Master", self.goal):
			# Try exact match first
			goal_id = frappe.db.get_value("Goal Master", {"goal_name": self.goal}, "name")
			if not goal_id:
				# Try case-insensitive fallback
				goal_id = frappe.db.get_value("Goal Master", {"goal_name": ["like", self.goal]}, "name")
			
			if goal_id:
				self.goal = goal_id

		goal = frappe.get_doc("Goal Master", self.goal)
		if goal.owner_type == "Company":
			frappe.throw("Company goals cannot have KRAs.")

		if not self.owner_type:
			self.owner_type = goal.owner_type
		
		if not self.company and goal.company:
			self.company = goal.company

		if not self.department and goal.department:
			self.department = goal.department

		if self.parent_kra:
			parent = frappe.get_doc("KRA Master", self.parent_kra)
			parent_goal = frappe.get_doc("Goal Master", parent.goal) if parent.goal else None

			if goal.owner_type not in ("Department", "Employee"):
				frappe.throw("Parent KRA can only be set for department or employee goals.")
			if not parent_goal or parent_goal.owner_type != "Department":
				frappe.throw("Parent KRA must belong to a department goal.")
			if parent_goal.department and not is_same_or_ancestor_department(goal.department, parent_goal.department):
				frappe.throw("Parent KRA can only come from the same department or a parent department.")
			if goal.parent_goal and parent.goal != goal.parent_goal:
				frappe.throw("Parent KRA must belong to the parent department goal.")

		if self.owner_type and goal.owner_type and self.owner_type != goal.owner_type:
			frappe.throw("KRA owner type must match the linked goal's owner type.")

		self.validate_goal_consistency(goal)

	def validate_goal_consistency(self, goal):
		if self.owner_type != "Employee" or not self.parent_kra or not goal.parent_goal:
			return

		parent_kra_goal = frappe.db.get_value("KRA Master", self.parent_kra, "goal")
		if goal.parent_goal != parent_kra_goal:
			frappe.throw(f"Goal {self.goal} must roll up to the same Department Goal as Parent KRA {self.parent_kra}")

	def validate_weightage(self):
		if not self.goal:
			return

		validate_weightage_allocation(
			"KRA Master",
			{"goal": self.goal},
			self.weightage,
			current_name=self.name,
			context_label=f"KRAs under Goal {self.goal}",
		)
