frappe.query_reports["Performance Analytics"] = {
    "filters": [
        {
            "fieldname": "period_start",
            "label": __("Period Start"),
            "fieldtype": "Date",
            "default": frappe.datetime.add_months(frappe.datetime.get_today(), -1)
        },
        {
            "fieldname": "period_end",
            "label": __("Period End"),
            "fieldtype": "Date",
            "default": frappe.datetime.get_today()
        }
    ]
};
