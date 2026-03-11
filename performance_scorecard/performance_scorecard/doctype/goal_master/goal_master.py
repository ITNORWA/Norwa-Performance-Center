import frappe
from frappe.model.document import Document

class GoalMaster(Document):
	def validate(self):
		self.normalize_defaults()
		self.validate_hierarchy()

	def normalize_defaults(self):
		if self.owner_type == "Company":
			self.employee = None
			self.department = None

		if self.owner_type == "Employee" and self.employee and not self.department:
			self.department = frappe.db.get_value("Employee", self.employee, "department")
		
		# Set company based on Employee or Department
		if not self.company:
			if self.owner_type == "Employee" and self.employee:
				self.company = frappe.db.get_value("Employee", self.employee, "company")
			elif self.owner_type == "Department" and self.department:
				self.company = frappe.db.get_value("Department", self.department, "company")

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
			parent = frappe.get_doc("Goal Master", self.parent_goal)

			if self.owner_type == "Department" and parent.owner_type != "Company":
				frappe.throw("Department goals must roll up to a company goal.")
			if self.owner_type == "Employee" and parent.owner_type != "Department":
				frappe.throw("Employee goals must roll up to a department goal.")

			if parent.kpa and self.kpa and self.kpa != parent.kpa:
				frappe.throw("Goal KPA must match the parent goal KPA.")
			if parent.kpa and not self.kpa:
				self.kpa = parent.kpa

		if self.owner_type == "Employee" and not self.kpa and self.parent_goal:
			parent = frappe.get_doc("Goal Master", self.parent_goal)
			self.kpa = parent.kpa

		self.validate_parent_links()

	def validate_parent_links(self):
		if self.owner_type != "Employee" or not self.parent_kra:
			return

		# Ensure parent_kra belongs to parent_goal
		kra_goal = frappe.db.get_value("KRA Master", self.parent_kra, "goal")
		if not self.parent_goal:
			self.parent_goal = kra_goal
		elif self.parent_goal != kra_goal:
			frappe.throw(f"Parent KRA {self.parent_kra} does not belong to Parent Goal {self.parent_goal}")

@frappe.whitelist()
@frappe.validate_and_sanitize_search_inputs
def get_department_kra_query(doctype, txt, searchfield, start, page_len, filters):
	department = filters.get("department")
	if not department:
		return []

	return frappe.db.sql(f"""
		SELECT name, kra_name, goal
		FROM `tabKRA Master`
		WHERE goal IN (SELECT name FROM `tabGoal Master` WHERE department = %s AND owner_type = 'Department')
		AND (name LIKE %s OR kra_name LIKE %s)
		LIMIT %s, %s
	""", (department, f"%{txt}%", f"%{txt}%", start, page_len))


@frappe.whitelist()
def get_linked_department_kra(parent_goal=None):
	if not parent_goal:
		return {}

	kras = frappe.get_all(
		"KRA Master",
		filters={"goal": parent_goal, "owner_type": "Department"},
		fields=["name", "goal"],
		order_by="modified desc",
		limit=2,
	)
	if len(kras) == 1:
		return {"name": kras[0].name, "goal": kras[0].goal, "is_unique": True, "count": 1}

	return {"name": None, "goal": parent_goal, "is_unique": False, "count": len(kras)}


@frappe.whitelist()
def get_employee_goal_for_parent_kra(parent_kra=None, employee=None):
	if not parent_kra or not employee:
		return {}

	parent_goal = frappe.db.get_value("KRA Master", parent_kra, "goal")
	if not parent_goal:
		return {}

	exact_match = frappe.get_all(
		"Goal Master",
		filters={
			"owner_type": "Employee",
			"employee": employee,
			"parent_goal": parent_goal,
			"parent_kra": parent_kra,
		},
		fields=["name"],
		limit=1,
	)
	if exact_match:
		return {"name": exact_match[0].name, "parent_goal": parent_goal, "matched_by": "parent_kra", "count": 1}

	candidates = frappe.get_all(
		"Goal Master",
		filters={
			"owner_type": "Employee",
			"employee": employee,
			"parent_goal": parent_goal,
		},
		fields=["name"],
		order_by="modified desc",
		limit=2,
	)
	if len(candidates) == 1:
		return {"name": candidates[0].name, "parent_goal": parent_goal, "matched_by": "parent_goal", "count": 1}

	return {"name": None, "parent_goal": parent_goal, "matched_by": None, "count": len(candidates)}
