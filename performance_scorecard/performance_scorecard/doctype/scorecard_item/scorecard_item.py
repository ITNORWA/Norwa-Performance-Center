import frappe
from frappe.model.document import Document
from frappe.utils import flt

from performance_scorecard.performance_scorecard.doctype.weekly_commitment.weekly_commitment import get_kpi_commitment_total
from performance_scorecard.performance_scorecard.scoring_engine import ScoringEngine


class ScorecardItem(Document):
	pass


@frappe.whitelist()
def update_scorecard_item_actual(item_name, base_actual):
	item = frappe.db.get_value(
		"Scorecard Item",
		item_name,
		["parent", "kpi", "target", "kra"],
		as_dict=True
	)
	if not item:
		return

	scorecard = item.parent
	employee = frappe.db.get_value("Performance Scorecard", scorecard, "employee")
	commitment_total = get_kpi_commitment_total(employee, item.kpi)
	base_actual = flt(base_actual or 0)
	actual = base_actual + flt(commitment_total)
	target = flt(item.target or 0)
	score = ScoringEngine.calculate_kpi_score(item.kpi, actual, target)
	frappe.db.set_value(
		"Scorecard Item",
		item_name,
		{"base_actual": base_actual, "actual": actual, "score": score}
	)
	if item.kra:
		ScoringEngine.update_kra_progress(item.kra)

	scorecard_doc = frappe.get_doc("Performance Scorecard", scorecard)
	scorecard_doc.flags.from_performance_update = True
	scorecard_doc.overall_score = ScoringEngine.calculate_scorecard_score(scorecard_doc)
	scorecard_doc.refresh_derived_tables()
	scorecard_doc.save(ignore_permissions=True)
	scorecard_doc.db_set("overall_score", scorecard_doc.overall_score, update_modified=False)
