import frappe
from frappe.model.document import Document

from performance_scorecard.performance_scorecard.doctype.performance_scorecard.performance_scorecard import (
	add_kpi_to_active_scorecard,
)

class KPIMaster(Document):
	def validate(self):
		self.validate_kra()

	def validate_kra(self):
		if not self.kra:
			frappe.throw("KPI must be linked to a KRA.")

		goal = frappe.db.get_value(
			"KRA Master",
			self.kra,
			["goal"],
			as_dict=True,
		)
		if not goal or not goal.goal:
			frappe.throw("KPI KRA must be linked to a goal.")

		goal_row = frappe.db.get_value(
			"Goal Master",
			goal.goal,
			["owner_type", "employee"],
			as_dict=True,
		)
		owner_type = goal_row.owner_type if goal_row else None
		if owner_type != "Employee":
			frappe.throw("KPIs can only be created for employee goals.")

		if not goal_row or not goal_row.employee:
			frappe.throw("KPI goal must be linked to an employee.")

		self.employee = goal_row.employee
		if not self.company and self.employee:
			self.company = frappe.db.get_value("Employee", self.employee, "company")

	def after_insert(self):
		add_kpi_to_active_scorecard(self.employee, self.name)
