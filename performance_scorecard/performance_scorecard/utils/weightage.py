import frappe
from frappe.utils import flt


MAX_WEIGHTAGE = 100.0


def validate_weightage_allocation(doctype, filters, current_weightage, current_name=None, context_label="records"):
	current_weightage = flt(current_weightage)
	if current_weightage < 0:
		frappe.throw("Weightage cannot be negative.")

	sibling_filters = dict(filters or {})
	if current_name:
		sibling_filters["name"] = ["!=", current_name]

	sibling_rows = frappe.get_all(doctype, filters=sibling_filters, fields=["weightage"])
	allocated = sum(flt(row.weightage) for row in sibling_rows)
	remaining = MAX_WEIGHTAGE - allocated

	if current_weightage > remaining + 1e-9:
		frappe.throw(
			f"Weightage exceeded for {context_label}. "
			f"Allocated: {allocated:.3f}%. Remaining: {max(remaining, 0):.3f}%. "
			f"You tried to save {current_weightage:.3f}%, which would total {allocated + current_weightage:.3f}%."
		)


def get_effective_kpi_weightage(kpi_name):
	if not kpi_name:
		return 0

	kpi_row = frappe.db.get_value(
		"KPI Master",
		kpi_name,
		["kra", "weightage"],
		as_dict=True,
	)
	if not kpi_row:
		return 0

	kra_row = (
		frappe.db.get_value("KRA Master", kpi_row.kra, ["goal", "weightage"], as_dict=True)
		if kpi_row.kra
		else None
	)
	goal_row = (
		frappe.db.get_value("Goal Master", kra_row.goal, ["kpa", "weightage"], as_dict=True)
		if kra_row and kra_row.goal
		else None
	)
	kpa_weightage = (
		frappe.db.get_value("KPA Master", goal_row.kpa, "weightage")
		if goal_row and goal_row.kpa
		else 0
	)

	return (
		flt(kpa_weightage)
		* flt(goal_row.weightage if goal_row else 0)
		* flt(kra_row.weightage if kra_row else 0)
		* flt(kpi_row.weightage)
	) / (100.0 ** 3)
