import json
import os
import frappe


def clean_dashboard_items():
    def has_bad_filters(doc):
        txt = (doc.get("filters_json") or "") + (doc.get("dynamic_filters_json") or "")
        return "company" in txt or "scope_type" in txt

    if frappe.db.exists("Dashboard", "Performance"):
        dash = frappe.get_doc("Dashboard", "Performance")
        if dash.module != "Performance Scorecard":
            frappe.delete_doc("Dashboard", "Performance", force=1, ignore_permissions=True)

    for dt in ("Dashboard Chart", "Number Card"):
        names = frappe.get_all(dt, filters={"document_type": "Performance Scorecard"}, pluck="name")
        for name in names:
            doc = frappe.get_doc(dt, name)
            if has_bad_filters(doc):
                frappe.delete_doc(dt, name, force=1, ignore_permissions=True)

    frappe.db.commit()
    return "Cleaned old dashboard items"


def ensure_workspace_routes():
    conflict_names = ("performance-scorecard", "Performance Scorecard", "Performance Center")
    target_name = "performance-center"

    for name in conflict_names:
        if not frappe.db.exists("Workspace", name):
            continue

        ws = frappe.get_doc("Workspace", name)
        if ws.module != "Performance Scorecard":
            continue

        if frappe.db.exists("Workspace", target_name):
            frappe.delete_doc("Workspace", name, force=1, ignore_permissions=True)
        else:
            frappe.rename_doc("Workspace", name, target_name, force=True)
            ws = frappe.get_doc("Workspace", target_name)
            ws.label = "Performance Center"
            ws.title = "Performance Center"
            ws.save(ignore_permissions=True)

    workspace_path = frappe.get_app_path(
        "performance_scorecard",
        "performance_scorecard",
        "workspace",
        "performance_center",
        "performance_center.json",
    )
    if os.path.exists(workspace_path):
        frappe.reload_doc("Performance Scorecard", "workspace", "performance_center")

    ws = frappe.get_doc("Workspace", target_name)
    updated = False
    if ws.label != "Performance Center" or ws.title != "Performance Center":
        ws.label = "Performance Center"
        ws.title = "Performance Center"
        updated = True

    desired_shortcuts = [
        {"label": "Visit Performance Center", "link_to": "performance-dashboard", "type": "Page"},
        {"label": "Strategy Plans", "link_to": "strategy-plans", "type": "Page"},
        {"label": "Strategy Maps", "link_to": "strategy-maps", "type": "Page"},
    ]
    desired_links = [
        {"type": "Card Break", "label": "Dashboard", "hidden": 0, "is_query_report": 0, "link_count": 0, "onboard": 0},
        {
            "type": "Link",
            "label": "Visit Performance Center",
            "link_type": "Page",
            "link_to": "performance-dashboard",
            "hidden": 0,
            "is_query_report": 0,
            "link_count": 0,
            "dependencies": "",
            "onboard": 0,
        },
        {
            "type": "Link",
            "label": "Strategy Plans",
            "link_type": "Page",
            "link_to": "strategy-plans",
            "hidden": 0,
            "is_query_report": 0,
            "link_count": 0,
            "dependencies": "",
            "onboard": 0,
        },
        {
            "type": "Link",
            "label": "Strategy Maps",
            "link_type": "Page",
            "link_to": "strategy-maps",
            "hidden": 0,
            "is_query_report": 0,
            "link_count": 0,
            "dependencies": "",
            "onboard": 0,
        },
    ]
    desired_content = json.dumps(
        [
            {"id": "ps-shortcut", "type": "shortcut", "data": {"shortcut_name": "Visit Performance Center", "col": 4}},
            {"id": "ps-strategy-plans", "type": "shortcut", "data": {"shortcut_name": "Strategy Plans", "col": 4}},
            {"id": "ps-strategy-maps", "type": "shortcut", "data": {"shortcut_name": "Strategy Maps", "col": 4}},
        ],
        separators=(",", ":"),
    )

    if ws.shortcuts != desired_shortcuts:
        ws.set("shortcuts", [])
        for item in desired_shortcuts:
            ws.append("shortcuts", item)
        updated = True
    if ws.links != desired_links:
        ws.set("links", [])
        for item in desired_links:
            ws.append("links", item)
        updated = True
    if ws.content != desired_content:
        ws.content = desired_content
        updated = True

    if updated:
        ws.save(ignore_permissions=True)

    frappe.db.commit()
    return "Workspace routes ensured"
