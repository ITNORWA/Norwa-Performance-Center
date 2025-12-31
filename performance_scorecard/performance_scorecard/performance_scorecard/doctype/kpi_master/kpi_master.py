import frappe
from frappe.model.document import Document

class KPIMaster(Document):
	def validate(self):
		self.validate_kra()

	def validate_kra(self):
		if not self.kra:
			frappe.throw("KPI must be linked to a KRA.")

		goal = frappe.db.get_value(
			"KRA",
			self.kra,
			["goal"],
			as_dict=True,
		)
		if not goal or not goal.goal:
			frappe.throw("KPI KRA must be linked to a goal.")

		owner_type = frappe.db.get_value("Goal", goal.goal, "owner_type")
		if owner_type != "Employee":
			frappe.throw("KPIs can only be created for employee goals.")
