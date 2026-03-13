import frappe


def get_department_ancestors(department, include_self=True):
    if not department:
        return []

    ancestors = []
    current = department
    seen = set()

    while current and current not in seen:
        seen.add(current)
        ancestors.append(current)
        current = frappe.db.get_value("Department", current, "parent_department")

    if include_self:
        return ancestors

    return ancestors[1:]


def is_same_or_ancestor_department(child_department, possible_ancestor):
    if not child_department or not possible_ancestor:
        return False

    return possible_ancestor in get_department_ancestors(child_department, include_self=True)
