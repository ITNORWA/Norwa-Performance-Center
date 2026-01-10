import frappe
from frappe.model.document import Document

class Goal(Document):
	def validate(self):
		self.normalize_defaults()
		self.validate_hierarchy()

	def normalize_defaults(self):
		if self.owner_type == "Company":
			self.employee = None
			self.department = None

		if self.owner_type == "Employee" and self.employee and not self.department:
			self.department = frappe.db.get_value("Employee", self.employee, "department")

	def validate_hierarchy(self):
		if self.owner_type == "Company":
			if not self.kpa:
				frappe.throw("Company goals must be linked to a KPA.")
			if self.parent_goal:
				frappe.throw("Company goals cannot have a parent goal.")
			return

		if self.owner_type == "Department":
			if not self.department:
				frappe.throw("Department goals must be linked to a department.")
			if not self.parent_goal:
				frappe.throw("Department goals must have a parent company goal.")

		if self.owner_type == "Employee":
			if not self.employee:
				frappe.throw("Employee goals must be linked to an employee.")
			if not self.parent_goal:
				frappe.throw("Employee goals must have a parent department goal.")

		if self.parent_goal:
			parent = frappe.get_doc("Goal", self.parent_goal)

			if self.owner_type == "Department" and parent.owner_type != "Company":
				frappe.throw("Department goals must roll up to a company goal.")
			if self.owner_type == "Employee" and parent.owner_type != "Department":
				frappe.throw("Employee goals must roll up to a department goal.")

			if parent.kpa and self.kpa and self.kpa != parent.kpa:
				frappe.throw("Goal KPA must match the parent goal KPA.")
			if parent.kpa and not self.kpa:
				self.kpa = parent.kpa

		if self.owner_type == "Employee" and not self.kpa and self.parent_goal:
			parent = frappe.get_doc("Goal", self.parent_goal)
			self.kpa = parent.kpa
