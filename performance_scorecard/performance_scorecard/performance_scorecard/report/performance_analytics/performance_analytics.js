frappe.query_reports["Performance Analytics"] = {
    "filters": [
        {
            "fieldname": "company",
            "label": __("Company"),
            "fieldtype": "Link",
            "options": "Company",
            "default": frappe.defaults.get_user_default("Company"),
            "reqd": 1
        },
        {
            "fieldname": "period_start",
            "label": __("Period Start"),
            "fieldtype": "Date",
            "reqd": 1
        },
        {
            "fieldname": "period_end",
            "label": __("Period End"),
            "fieldtype": "Date",
            "reqd": 1
        }
    ]
};
