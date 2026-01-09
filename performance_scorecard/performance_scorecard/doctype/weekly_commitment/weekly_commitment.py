import frappe
from frappe.model.document import Document


class WeeklyCommitment(Document):
	def before_insert(self):
		if self.employee:
			return
		employee = frappe.db.get_value("Employee", {"user_id": frappe.session.user}, "name")
		if employee:
			self.employee = employee

	def before_save(self):
		self._sync_kpi_actual()

	def _sync_kpi_actual(self):
		if not self.kpi or not self.employee:
			return

		previous = self.get_doc_before_save()
		prev_value = _parse_percent(previous.status) if previous else 0
		current_value = _parse_percent(self.status)
		delta = current_value - prev_value
		if not delta:
			return

		scorecard = frappe.db.get_value(
			"Performance Scorecard",
			{"employee": self.employee},
			"name",
			order_by="modified desc"
		)
		if not scorecard:
			return

		item = frappe.db.get_value(
			"Scorecard Item",
			{"parent": scorecard, "kpi": self.kpi},
			["name", "actual"],
			as_dict=True
		)
		if not item:
			return

		actual = float(item.actual or 0)
		frappe.db.set_value("Scorecard Item", item.name, "actual", actual + delta)


def _parse_percent(value):
	if value is None:
		return 0
	text = str(value).strip().replace("%", "")
	try:
		return float(text)
	except ValueError:
		return 0
