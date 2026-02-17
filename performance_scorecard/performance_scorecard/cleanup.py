import json
import os
import frappe


def clean_dashboard_items():
    # Deprecated cleanup logic. Disabling to prevent data loss.
    return "Skipped cleanup"


    if not frappe.db.exists("Workspace", target_name):
        # Only create if it doesn't exist. Do NOT overwrite user customizations.
        ws = frappe.new_doc("Workspace")
        ws.name = target_name
        ws.label = "Performance Center"
        ws.title = "Performance Center"
        ws.public = 1
        ws.module = "Performance Scorecard"
        ws.shortcuts = desired_shortcuts
        ws.links = desired_links
        # ws.content = desired_content # Let Frappe handle default content or set minimal
        ws.insert(ignore_permissions=True)
        frappe.db.commit()
        return "Created Performance Center workspace"

    return "Workspace already exists, skipping overwrite"
