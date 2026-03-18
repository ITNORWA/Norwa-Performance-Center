import frappe
from frappe.model.document import Document

from performance_scorecard.performance_scorecard.utils.scorecard_sync import (
	sync_scorecard_from_updates,
)

APPROVER_ROLES = {"System Manager", "HR Manager", "Department Manager"}
REVIEWABLE_STATUSES = {"Draft", "Pending Review", "Approved", "Rejected"}

class PerformanceUpdate(Document):
	def validate(self):
		if not self.company and self.scorecard:
			self.company = frappe.db.get_value("Performance Scorecard", self.scorecard, "company")
		if not self.company and self.kpi:
			self.company = frappe.db.get_value("KPI Master", self.kpi, "company")
		self._normalize_status()

	def before_submit(self):
		if not self._can_approve():
			frappe.throw("Only a manager can submit and approve a Performance Update.")
		self.status = "Approved"

	def on_update(self):
		self._sync_scorecard_refs()

	def on_submit(self):
		self._sync_scorecard_refs()

	def on_cancel(self):
		self._sync_scorecard_refs()

	def _normalize_status(self):
		status = (self.status or "Draft").strip() or "Draft"
		if status not in REVIEWABLE_STATUSES:
			status = "Draft"

		previous = self.get_doc_before_save()
		previous_status = (previous.status or "").strip() if previous else ""
		can_approve = self._can_approve()

		if previous and previous_status == "Approved" and not can_approve and self._has_material_change(previous):
			status = "Pending Review"
		elif not can_approve:
			if status == "Approved":
				frappe.throw("Only a manager can approve a Performance Update.")
			if status in {"Draft", "Rejected"}:
				status = "Pending Review"
		elif status == "Draft":
			status = "Pending Review"

		self.status = status

	def _has_material_change(self, previous):
		fields = ("scorecard", "kpi", "target", "actual_value", "evidence")
		return any((self.get(field) or None) != (previous.get(field) or None) for field in fields)

	def _can_approve(self):
		return bool(APPROVER_ROLES.intersection(set(frappe.get_roles())))

	def _sync_scorecard_refs(self):
		refs = {(self.scorecard, self.kpi)}
		previous = self.get_doc_before_save()
		if previous:
			refs.add((previous.scorecard, previous.kpi))

		for scorecard_name, kpi_name in refs:
			if scorecard_name and kpi_name:
				sync_scorecard_from_updates(scorecard_name, kpi_name)
