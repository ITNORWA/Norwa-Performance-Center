import frappe
from frappe.model.document import Document
from frappe.utils import flt

from performance_scorecard.performance_scorecard.scoring_engine import ScoringEngine


class WeeklyCommitment(Document):
	def autoname(self):
		self._ensure_employee()
		if self.employee and self.week_start:
			self.name = f"WC-{self.employee}-{self.week_start}"

	def before_insert(self):
		if self.employee:
			return
		employee = frappe.db.get_value("Employee", {"user_id": frappe.session.user}, "name")
		if employee:
			self.employee = employee

	def before_save(self):
		self._ensure_employee()
		self._set_kpi_unit()
		self._sync_kpi_actual()

	def _ensure_employee(self):
		if self.employee:
			return
		employee = frappe.db.get_value("Employee", {"user_id": frappe.session.user}, "name")
		if employee:
			self.employee = employee
			return
		if self.kpi:
			kpi_employee = frappe.db.get_value("KPI Master", self.kpi, "employee")
			if kpi_employee:
				self.employee = kpi_employee

	def _set_kpi_unit(self):
		if not self.kpi:
			return
		unit = frappe.db.get_value("KPI Master", self.kpi, "unit")
		if unit:
			self.kpi_unit = unit

	def _sync_kpi_actual(self):
		if not self.kpi or not self.employee:
			return

		self._set_kpi_unit()

		previous = self.get_doc_before_save()
		prev_value = _get_commitment_value(previous) if previous else 0
		current_value = _get_commitment_value(self)

		if previous and previous.kpi and previous.kpi != self.kpi:
			prev_total = _get_commitment_total_excluding(self.employee, previous.kpi, self.name) + prev_value
			new_total = _get_commitment_total_excluding(self.employee, previous.kpi, self.name)
			_apply_commitment_totals(self.employee, previous.kpi, prev_total, new_total)

			prev_total = _get_commitment_total_excluding(self.employee, self.kpi, self.name)
			new_total = prev_total + current_value
			_apply_commitment_totals(self.employee, self.kpi, prev_total, new_total)
			return

		prev_total = _get_commitment_total_excluding(self.employee, self.kpi, self.name) + prev_value
		new_total = _get_commitment_total_excluding(self.employee, self.kpi, self.name) + current_value
		_apply_commitment_totals(self.employee, self.kpi, prev_total, new_total)


@frappe.whitelist()
def update_commitment(name, field, value):
	doc = frappe.get_doc("Weekly Commitment", name)
	doc.set(field, value)
	doc.save(ignore_permissions=True)
	return {
		"name": doc.name,
		"kpi": doc.kpi,
		"kpi_unit": doc.kpi_unit,
		"actual_value": doc.actual_value,
	}


def _apply_commitment_totals(employee, kpi, prev_total, new_total):
	if not kpi or not employee:
		return

	scorecard = frappe.db.get_value(
		"Performance Scorecard",
		{"employee": employee, "docstatus": ["in", [0, 1]]},
		"name",
		order_by="modified desc"
	)
	if not scorecard:
		return

	item = frappe.db.get_value(
		"Scorecard Item",
		{"parent": scorecard, "kpi": kpi},
		["name", "actual", "base_actual", "target", "kra"],
		as_dict=True
	)
	if not item:
		return

	base_actual = item.base_actual
	if base_actual is None:
		base_actual = flt(item.actual or 0) - flt(prev_total or 0)
	actual = flt(base_actual) + flt(new_total or 0)
	target = flt(item.target or 0)
	score = (actual / target) * 100 if target else 0
	frappe.db.set_value("Scorecard Item", item.name, {"base_actual": base_actual, "actual": actual, "score": score})
	if item.kra:
		ScoringEngine.update_kra_progress(item.kra)

	scorecard_doc = frappe.get_doc("Performance Scorecard", scorecard)
	scorecard_doc.overall_score = ScoringEngine.calculate_scorecard_score(scorecard_doc)
	scorecard_doc.db_set("overall_score", scorecard_doc.overall_score, update_modified=False)

def _get_commitment_total_excluding(employee, kpi, commitment_name):
	if not employee or not kpi:
		return 0
	filters = {"employee": employee, "kpi": kpi}
	if commitment_name:
		filters["name"] = ["!=", commitment_name]
	rows = frappe.get_all(
		"Weekly Commitment",
		filters=filters,
		fields=["actual_value", "status"]
	)
	return sum(_get_commitment_value(row) for row in rows)

def get_kpi_commitment_total(employee, kpi):
	if not employee or not kpi:
		return 0
	rows = frappe.get_all(
		"Weekly Commitment",
		filters={"employee": employee, "kpi": kpi},
		fields=["actual_value", "status"]
	)
	return sum(_get_commitment_value(row) for row in rows)


def _get_commitment_value(doc):
	if not doc:
		return 0
	if doc.actual_value is not None and doc.actual_value != "":
		return flt(doc.actual_value)
	value = doc.status
	if value is None:
		return 0
	text = str(value).strip().replace("%", "")
	try:
		return float(text)
	except ValueError:
		return 0
