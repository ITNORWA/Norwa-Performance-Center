import frappe
from frappe.model.document import Document
from frappe.utils import nowdate

from performance_scorecard.performance_scorecard.scoring_engine import ScoringEngine

class PerformanceScorecard(Document):
	def validate(self):
		self.set_department()
		self._validate_unique_period()
		self.populate_items_from_kpis()
		self.calculate_score()

	def calculate_score(self):
		self.overall_score = ScoringEngine.calculate_scorecard_score(self)

	def set_department(self):
		if self.employee and not self.department:
			self.department = frappe.db.get_value("Employee", self.employee, "department")

	def populate_items_from_kpis(self):
		if self.items or not self.employee:
			return

		goals = frappe.get_all(
			"Goal Master",
			filters={"owner_type": "Employee", "employee": self.employee},
			fields=["name", "kpa"],
		)
		if not goals:
			return

		goal_map = {g.name: g for g in goals}
		kras = frappe.get_all(
			"KRA Master",
			filters={"goal": ["in", list(goal_map.keys())]},
			fields=["name", "goal"],
		)
		if not kras:
			return

		kra_map = {k.name: k.goal for k in kras}
		kpis = frappe.get_all(
			"KPI Master",
			filters={
				"kra": ["in", list(kra_map.keys())],
				"employee": self.employee,
			},
			fields=["name", "kra"],
		)
		if not kpis:
			return

		for kpi in kpis:
			goal_name = kra_map.get(kpi.kra)
			goal_row = goal_map.get(goal_name)
			self.append(
				"items",
				{
					"kpa": (goal_row.kpa if goal_row else None),
					"goal": goal_name,
					"kra": kpi.kra,
					"kpi": kpi.name,
					"weightage": 0,
				},
			)

	def _validate_unique_period(self):
		if not self.employee or not self.start_date or not self.end_date:
			return
		existing = frappe.db.exists(
			"Performance Scorecard",
			{
				"employee": self.employee,
				"start_date": self.start_date,
				"end_date": self.end_date,
				"name": ["!=", self.name],
				"docstatus": ["<", 2],
			},
		)
		if existing:
			frappe.throw(
				"Only one scorecard is allowed per employee for the selected period."
			)


def add_kpi_to_active_scorecard(employee, kpi_name):
	if not employee or not kpi_name:
		return

	today = nowdate()
	scorecard = frappe.db.get_value(
		"Performance Scorecard",
		{
			"employee": employee,
			"docstatus": ["<", 2],
			"start_date": ["<=", today],
			"end_date": [">=", today],
		},
		"name",
		order_by="modified desc",
	)
	if not scorecard:
		return

	if frappe.db.exists("Scorecard Item", {"parent": scorecard, "kpi": kpi_name}):
		return

	kpi_doc = frappe.db.get_value("KPI Master", kpi_name, ["kra"], as_dict=True)
	kra_name = kpi_doc.kra if kpi_doc else None
	goal_row = frappe.db.get_value("KRA Master", kra_name, ["goal"], as_dict=True) if kra_name else None
	goal_name = goal_row.goal if goal_row else None
	kpa_row = frappe.db.get_value("Goal Master", goal_name, ["kpa"], as_dict=True) if goal_name else None
	kpa_name = kpa_row.kpa if kpa_row else None

	scorecard_doc = frappe.get_doc("Performance Scorecard", scorecard)
	scorecard_doc.append(
		"items",
		{
			"kpa": kpa_name,
			"goal": goal_name,
			"kra": kra_name,
			"kpi": kpi_name,
			"weightage": 0,
		},
	)
	scorecard_doc.save(ignore_permissions=True)


def get_permission_query_conditions(user):
	if user == "Administrator":
		return None
	roles = frappe.get_roles(user)
	if any(role in roles for role in ("System Manager", "HR Manager", "Department Manager")):
		return None
	employee = frappe.db.get_value("Employee", {"user_id": user}, "name")
	if employee:
		return f"`tabPerformance Scorecard`.employee = {frappe.db.escape(employee)}"
	return "1=0"
