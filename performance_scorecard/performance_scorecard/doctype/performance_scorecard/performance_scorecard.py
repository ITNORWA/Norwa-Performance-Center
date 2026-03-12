import frappe
from frappe.model.document import Document
from frappe import _
from frappe.utils import nowdate

from performance_scorecard.performance_scorecard.scoring_engine import ScoringEngine

class PerformanceScorecard(Document):
	def validate(self):
		self.resolve_names()
		self.set_department()
		self._validate_unique_period()
		self.populate_items_from_kpis()
		self.check_modifications()
		self.calculate_score()

	def calculate_score(self):
		self.overall_score = ScoringEngine.calculate_scorecard_score(self)

	def check_modifications(self):
		if self.flags.from_performance_update:
			return

		if self.is_new():
			return

		# Allow System Manager or HR Manager to bypass for corrections
		user_roles = frappe.get_roles()
		if "System Manager" in user_roles or "HR Manager" in user_roles:
			return

		old_doc = self.get_doc_before_save()
		if not old_doc:
			return

		old_items = {item.name: item for item in old_doc.items}
		for item in self.items:
			if item.name in old_items:
				old_item = old_items[item.name]
				if (frappe.utils.flt(item.actual) != frappe.utils.flt(old_item.actual) or 
					frappe.utils.flt(item.base_actual) != frappe.utils.flt(old_item.base_actual)):
					frappe.throw(
						f"Direct modification of Actual values is not allowed for KPI: {item.kpi}. "
						"Please use the 'Performance Update' process for verification."
					)

	def resolve_names(self):
		for item in self.get("items", []):
			for field, doctype, name_field in [
				("goal", "Goal Master", "goal_name"),
				("kra", "KRA Master", "kra_name"),
				("kpa", "KPA Master", "kpa_name"),
				("kpi", "KPI Master", "kpi_name")
			]:
				val = item.get(field)
				if val and isinstance(val, str):
					val = val.strip()
					item.set(field, val)
					
					if not frappe.db.exists(doctype, val):
						# Try exact case match first
						resolved = frappe.db.get_value(doctype, {name_field: val}, "name")
						if not resolved:
							# Try case-insensitive if exact name match fails
							resolved = frappe.db.get_value(doctype, {name_field: ["like", val]}, "name")
						
						if resolved:
							item.set(field, resolved)

	def set_department(self):
		if self.employee:
			if not self.department:
				self.department = frappe.db.get_value("Employee", self.employee, "department")
			if not self.company:
				self.company = frappe.db.get_value("Employee", self.employee, "company")

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
			fields=["name", "kra", "target"],
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
					"target": kpi.target or 0,
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
	
	kpi_doc = frappe.db.get_value("KPI Master", kpi_name, ["kra", "target"], as_dict=True)
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
			"target": kpi_doc.target if kpi_doc else 0,
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


@frappe.whitelist()
def get_scorecard_summary(employee, end_date):
	scorecard = frappe.db.get_value(
		"Performance Scorecard",
		{
			"employee": employee,
			"end_date": ["<=", end_date],
			"docstatus": 1
		},
		["name", "overall_score"],
		as_dict=True,
		order_by="end_date desc"
	)
	return scorecard


@frappe.whitelist()
def get_appraisal_scorecard(employee, appraisal_start_date=None, appraisal_end_date=None):
	if not employee:
		return None

	def fetch_scorecard(extra_filters=None, order_by="end_date desc, modified desc"):
		filters = {"employee": employee}
		if extra_filters:
			filters.update(extra_filters)
		return frappe.db.get_value(
			"Performance Scorecard",
			filters,
			"name",
			order_by=order_by,
		)

	period_filters = None
	if appraisal_start_date and appraisal_end_date:
		period_filters = {
			"start_date": ["<=", appraisal_end_date],
			"end_date": [">=", appraisal_start_date],
		}
	elif appraisal_end_date:
		period_filters = {
			"end_date": ["<=", appraisal_end_date],
		}

	search_variants = []
	if period_filters:
		search_variants.append({"status": "Approved", **period_filters})
	search_variants.append({"status": "Approved"})
	if period_filters:
		search_variants.append({"docstatus": 1, **period_filters})
	search_variants.append({"docstatus": 1})

	for filters in search_variants:
		scorecard = fetch_scorecard(filters)
		if scorecard:
			return scorecard

	return None


def _can_access_employee_scorecard(employee):
	if frappe.session.user == "Administrator":
		return True

	roles = set(frappe.get_roles())
	if roles.intersection({"System Manager", "HR Manager", "Department Manager"}):
		return True

	linked_employee = frappe.db.get_value("Employee", {"user_id": frappe.session.user}, "name")
	return linked_employee == employee


def _get_link_titles(doctype, names, title_field):
	names = [name for name in names if name]
	if not names:
		return {}

	rows = frappe.get_all(doctype, filters={"name": ["in", names]}, fields=["name", title_field])
	return {row.name: row.get(title_field) for row in rows}


def _serialize_scorecard_for_appraisal(scorecard_name):
	scorecard = frappe.get_doc("Performance Scorecard", scorecard_name)
	goal_titles = _get_link_titles("Goal Master", [item.goal for item in scorecard.items], "goal_name")
	kra_titles = _get_link_titles("KRA Master", [item.kra for item in scorecard.items], "kra_name")
	kpi_titles = _get_link_titles("KPI Master", [item.kpi for item in scorecard.items], "kpi_name")

	return {
		"name": scorecard.name,
		"employee": scorecard.employee,
		"department": scorecard.department,
		"company": scorecard.company,
		"start_date": scorecard.start_date,
		"end_date": scorecard.end_date,
		"overall_score": scorecard.overall_score,
		"status": scorecard.status,
		"items": [
			{
				"kpa": item.kpa,
				"goal": item.goal,
				"goal_name": goal_titles.get(item.goal) or item.goal,
				"kra": item.kra,
				"kra_name": kra_titles.get(item.kra) or item.kra,
				"kpi": item.kpi,
				"kpi_name": kpi_titles.get(item.kpi) or item.kpi,
				"weightage": item.weightage,
				"target": item.target,
				"actual": item.actual,
				"score": item.score,
			}
			for item in scorecard.items
		],
	}


@frappe.whitelist()
def get_appraisal_scorecard_payload(employee, appraisal_start_date=None, appraisal_end_date=None):
	if not employee:
		return None

	if not _can_access_employee_scorecard(employee):
		frappe.throw(_("Not permitted to access this employee's scorecard."), frappe.PermissionError)

	scorecard_name = get_appraisal_scorecard(employee, appraisal_start_date, appraisal_end_date)
	if not scorecard_name:
		return None

	return _serialize_scorecard_for_appraisal(scorecard_name)
