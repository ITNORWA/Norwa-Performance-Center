import frappe
from frappe.utils import flt

from performance_scorecard.performance_scorecard.doctype.weekly_commitment.weekly_commitment import (
	get_kpi_commitment_total,
)


def sync_scorecards_for_goal(goal_name):
	_sync_kra_master_defaults(goal_name)
	for kpi_name in _get_goal_kpis(goal_name):
		sync_scorecards_for_kpi(kpi_name, force_recalculate=True)


def sync_scorecards_for_kra(kra_name):
	_sync_kpi_master_defaults_for_kra(kra_name)
	for kpi_name in _get_kra_kpis(kra_name):
		sync_scorecards_for_kpi(kpi_name, force_recalculate=True)


def sync_scorecards_for_kpi(kpi_name, previous_employee=None, force_recalculate=False):
	if not kpi_name:
		return

	snapshot = _get_kpi_snapshot(kpi_name)
	_sync_kpi_master_defaults(kpi_name, snapshot)
	scorecards = _get_candidate_scorecards(kpi_name, snapshot, previous_employee)

	for scorecard_name in scorecards:
		_sync_scorecard_for_kpi(
			scorecard_name,
			kpi_name,
			snapshot=snapshot,
			force_recalculate=force_recalculate,
		)


def sync_scorecard_from_updates(scorecard_name, kpi_name):
	if not scorecard_name or not kpi_name:
		return

	snapshot = _get_kpi_snapshot(kpi_name)
	_sync_scorecard_for_kpi(
		scorecard_name,
		kpi_name,
		snapshot=snapshot,
		force_recalculate=True,
	)


def _get_candidate_scorecards(kpi_name, snapshot=None, previous_employee=None):
	scorecard_names = set(
		frappe.get_all(
			"Scorecard Item",
			filters={"kpi": kpi_name},
			pluck="parent",
		)
	)

	employees = {
		employee
		for employee in [previous_employee, (snapshot or {}).get("employee")]
		if employee
	}
	if employees:
		scorecard_names.update(
			frappe.get_all(
				"Performance Scorecard",
				filters={"employee": ["in", list(employees)], "docstatus": ["<", 2]},
				pluck="name",
			)
		)

	return sorted(scorecard_names)


def _get_goal_kpis(goal_name):
	if not goal_name:
		return []

	kras = frappe.get_all(
		"KRA Master",
		filters={"goal": goal_name},
		pluck="name",
	)
	if not kras:
		return []

	return frappe.get_all(
		"KPI Master",
		filters={"kra": ["in", kras]},
		pluck="name",
	)


def _get_kra_kpis(kra_name):
	if not kra_name:
		return []

	return frappe.get_all(
		"KPI Master",
		filters={"kra": kra_name},
		pluck="name",
	)


def _get_kpi_snapshot(kpi_name):
	kpi_row = frappe.db.get_value(
		"KPI Master",
		kpi_name,
		["name", "employee", "company", "kra", "target"],
		as_dict=True,
	)
	if not kpi_row:
		return None

	goal_name = frappe.db.get_value("KRA Master", kpi_row.kra, "goal") if kpi_row.kra else None
	goal_row = (
		frappe.db.get_value("Goal Master", goal_name, ["kpa", "employee", "company"], as_dict=True)
		if goal_name
		else None
	)
	return {
		"kpi": kpi_row.name,
		"employee": (goal_row or {}).get("employee") or kpi_row.employee,
		"company": (goal_row or {}).get("company") or kpi_row.company,
		"kra": kpi_row.kra,
		"goal": goal_name,
		"kpa": (goal_row or {}).get("kpa"),
		"target": kpi_row.target,
	}


def _sync_scorecard_for_kpi(scorecard_name, kpi_name, snapshot=None, force_recalculate=False):
	scorecard = frappe.get_doc("Performance Scorecard", scorecard_name)
	snapshot = snapshot if snapshot is not None else _get_kpi_snapshot(kpi_name)
	matching_items = [item for item in scorecard.items if item.kpi == kpi_name]
	should_keep_item = bool(snapshot and scorecard.employee == snapshot.get("employee"))

	mutated = False
	if not should_keep_item:
		if matching_items:
			for item in list(matching_items):
				scorecard.remove(item)
			mutated = True
		if mutated:
			_save_scorecard(scorecard)
		return

	base_actual, actual, target = _get_score_inputs(scorecard, kpi_name, snapshot)

	if not matching_items:
		scorecard.append(
			"items",
			{
				"kpa": snapshot.get("kpa"),
				"goal": snapshot.get("goal"),
				"kra": snapshot.get("kra"),
				"kpi": kpi_name,
				"weightage": 0,
				"target": target,
				"base_actual": base_actual,
				"actual": actual,
			},
		)
		mutated = True
	else:
		for item in matching_items:
			updates = {
				"kpa": snapshot.get("kpa"),
				"goal": snapshot.get("goal"),
				"kra": snapshot.get("kra"),
				"target": target,
				"base_actual": base_actual,
				"actual": actual,
			}
			for fieldname, value in updates.items():
				if _field_changed(item, fieldname, value):
					item.set(fieldname, value)
					mutated = True

	if mutated or force_recalculate:
		_save_scorecard(scorecard)


def _save_scorecard(scorecard):
	scorecard.flags.from_performance_update = True
	scorecard.flags.ignore_validate_update_after_submit = True
	scorecard.save(ignore_permissions=True)


def _get_score_inputs(scorecard, kpi_name, snapshot):
	approved_update = frappe.get_all(
		"Performance Update",
		filters={
			"scorecard": scorecard.name,
			"kpi": kpi_name,
			"status": "Approved",
			"docstatus": ["<", 2],
		},
		fields=["actual_value", "target"],
		order_by="modified desc",
		limit=1,
	)
	approved_row = approved_update[0] if approved_update else {}
	base_actual = flt(approved_row.get("actual_value"))
	target = approved_row.get("target")
	if target is None:
		target = snapshot.get("target") if snapshot else 0
	target = flt(target)
	commitment_total = get_kpi_commitment_total(scorecard.employee, kpi_name)
	actual = base_actual + flt(commitment_total)
	return base_actual, actual, target


def _field_changed(item, fieldname, value):
	if fieldname in {"target", "base_actual", "actual"}:
		return flt(item.get(fieldname)) != flt(value)
	return item.get(fieldname) != value


def _sync_kra_master_defaults(goal_name):
	if not goal_name:
		return

	goal = frappe.db.get_value(
		"Goal Master",
		goal_name,
		["owner_type", "employee", "department", "company"],
		as_dict=True,
	)
	if not goal:
		return

	kras = frappe.get_all(
		"KRA Master",
		filters={"goal": goal_name},
		fields=["name", "owner_type", "employee", "department", "company"],
	)
	for kra in kras:
		updates = {}
		for fieldname in ("owner_type", "employee", "department", "company"):
			target = goal.get(fieldname)
			if kra.get(fieldname) != target:
				updates[fieldname] = target
		if updates:
			frappe.db.set_value("KRA Master", kra.name, updates, update_modified=False)


def _sync_kpi_master_defaults_for_kra(kra_name):
	for kpi_name in _get_kra_kpis(kra_name):
		_sync_kpi_master_defaults(kpi_name, _get_kpi_snapshot(kpi_name))


def _sync_kpi_master_defaults(kpi_name, snapshot):
	if not kpi_name or not snapshot:
		return

	kpi_row = frappe.db.get_value(
		"KPI Master",
		kpi_name,
		["employee", "company"],
		as_dict=True,
	)
	if not kpi_row:
		return

	updates = {}
	for fieldname in ("employee", "company"):
		if kpi_row.get(fieldname) != snapshot.get(fieldname):
			updates[fieldname] = snapshot.get(fieldname)
	if updates:
		frappe.db.set_value("KPI Master", kpi_name, updates, update_modified=False)
