import datetime
import frappe
from frappe.utils import cstr, flt, getdate
from frappe.utils.csvutils import read_csv_content
from frappe.utils.xlsxutils import build_xlsx_response, read_xlsx_file_from_attached_file

ALLOWED_GOAL_STATUS = {"Draft", "Active", "Completed", "Archived"}

@frappe.whitelist()
def get_strategy_data(level, period=None, department=None, employee=None):
    # Fetch data based on level (Company, Department, Individual)
    # Return a list of items (Goals -> KRAs -> KPIs)
    
    filters = {"status": ["!=", "Archived"]}
    session_user = frappe.session.user
    session_employee = frappe.db.get_value("Employee", {"user_id": session_user}, "name")
    roles = frappe.get_roles(session_user)
    is_privileged = any(role in roles for role in ("System Manager", "HR Manager", "Department Manager"))
    if level == "Individual" and not is_privileged:
        employee = session_employee
    selected_employee = employee or session_employee
    selected_department = department
    dept_employees = []

    if level == "Company":
        filters["owner_type"] = "Company"
    elif level == "Department":
        filters["owner_type"] = "Department"
        # Filter by user's department
        if session_employee and not selected_department:
            selected_department = frappe.db.get_value("Employee", session_employee, "department")
        if selected_department:
            filters["department"] = selected_department
    elif level == "Individual":
        filters["owner_type"] = "Employee"
        if selected_department:
            filters["department"] = selected_department
            dept_employees = frappe.get_all(
                "Employee",
                filters={"department": selected_department},
                pluck="name",
            )
            if selected_employee and selected_employee not in dept_employees:
                selected_employee = None
        if selected_employee:
            filters["employee"] = selected_employee
        elif selected_department:
            if dept_employees:
                filters["employee"] = ["in", dept_employees]
            else:
                filters["employee"] = "__none__"
        else:
            # Fallback for users without an Employee record
            filters["owner"] = session_user

    goals = frappe.get_all(
        "Goal Master",
        filters=filters,
        fields=[
            "name",
            "goal_name",
            "weightage",
            "status",
            "start_date",
            "end_date",
            "kpa",
            "progress",
            "parent_goal",
            "owner_type",
            "department",
            "employee",
        ],
    )

    parent_names = [g.parent_goal for g in goals if g.get("parent_goal")]
    goal_name_map = {}
    if parent_names:
        for row in frappe.get_all(
            "Goal Master",
            filters={"name": ["in", list(set(parent_names))]},
            fields=["name", "goal_name"],
        ):
            goal_name_map[row.name] = row.goal_name

    kpa_map = {}
    kpa_names = [g.kpa for g in goals if g.get("kpa")]
    if kpa_names:
        for row in frappe.get_all(
            "KPA Master",
            filters={"name": ["in", list(set(kpa_names))]},
            fields=["name", "kpa_name"],
        ):
            kpa_map[row.name] = row.kpa_name

    employee_list = []
    if level == "Individual" and not selected_employee:
        if selected_department:
            employee_list = sorted(dept_employees)
        else:
            employee_list = sorted({g.get("employee") for g in goals if g.get("employee")})
        if len(employee_list) == 1:
            selected_employee = employee_list[0]

    scorecard_filters = _get_scorecard_filters(level, selected_employee or employee_list, filters.get("department"), session_user)
    kpi_scorecard_filters = scorecard_filters if level == "Individual" else None
    kpi_employee_filter = (selected_employee or employee_list) if level == "Individual" else None
    data = []
    kra_meta = frappe.get_meta("KRA Master")
    kra_fields = ["name", "kra_name", "weightage", "priority", "progress"]
    if kra_meta.has_field("description"):
        kra_fields.append("description")
    for goal in goals:
        # Fetch KRAs for this goal
        kras = frappe.get_all(
            "KRA Master",
            filters={"goal": goal.name},
            fields=kra_fields,
        )

        goal_data = {
            "name": goal.name,
            "goal_name": goal.goal_name,
            "kpa": kpa_map.get(goal.kpa) or goal.kpa,
            "kpa_key": goal.kpa,
            "kpa_label": kpa_map.get(goal.kpa) or goal.kpa,
            "parent_goal": goal.parent_goal,
            "parent_goal_name": goal_name_map.get(goal.parent_goal),
            "weightage": goal.weightage,
            "status": goal.status,
            "start_date": goal.start_date,
            "end_date": goal.end_date,
            "progress": 0,
            "kras": []
        }
        
        kra_progresses = []
        for kra in kras:
            # Fetch KPIs for this KRA (assuming link exists or via Scorecard)
            # For now, let's fetch KPIs that link to this KRA (we need to ensure KPI Master has parent_kra or similar, or use a mapping)
            # In our refined DocType, KPI Master has 'parent_kra' (wait, I didn't add it to KPI Master, I added 'goal' to KRA. KPI Master usually links to KRA in the Scorecard Item, but for Strategy Plan we might want a direct link or just list KPIs defined in Master that are relevant)
            # Let's assume KPI Master has a link to KRA or we fetch from Scorecard Items if they exist.
            # Actually, for Strategy Plan, we are defining the plan. So we should probably have KPIs linked to KRA in the Master definition if possible, or just show KRAs.
            # The spec says "Unified Table View".
            
            kpis = _get_kpis_for_kra(kra.name, kpi_scorecard_filters, kpi_employee_filter)
            kpi_scores = [flt(k.get("score")) for k in kpis if k.get("score") is not None]
            kra_progress = sum(kpi_scores) / len(kpi_scores) if kpi_scores else 0
            kra_progresses.append(kra_progress)

            kra_data = {
                "name": kra.name,
                "kra_name": kra.kra_name,
                "weightage": kra.weightage,
                "priority": kra.priority,
                "description": getattr(kra, "description", None),
                "progress": kra_progress,
                "kpis": kpis
            }
            goal_data["kras"].append(kra_data)

        if kra_progresses:
            goal_data["progress"] = sum(kra_progresses) / len(kra_progresses)

        data.append(goal_data)

    response = {
        "goals": data,
        "meta": {
            "level": level,
            "employee": selected_employee,
            "department": filters.get("department"),
        },
        "personal": {
            "scorecards": [],
            "updates": [],
        },
        "rows": [],
        "rollups": {},
        "company": {},
    }

    if level == "Individual":
        if not selected_employee and not employee_list:
            response["personal"]["scorecards"] = []
            response["personal"]["updates"] = []
            response["rows"] = []
            response["rollups"] = {"kpas": [], "overall_score": 0}
            return response

        if employee_list and not selected_employee:
            scorecard_filters = {"employee": ["in", employee_list], "docstatus": ["in", [0, 1]]}
        else:
            scorecard_filters = {"employee": selected_employee, "docstatus": ["in", [0, 1]]}
        goal_names = [g.get("name") for g in goals if g.get("name")]
        scorecards = frappe.get_all(
            "Performance Scorecard",
            filters=scorecard_filters,
            fields=["name", "status", "start_date", "end_date", "overall_score"],
            order_by="modified desc",
            limit=10,
        )
        if not scorecards and goal_names:
            parent_rows = frappe.get_all(
                "Scorecard Item",
                filters={"goal": ["in", goal_names]},
                pluck="parent"
            )
            parent_names = list(set(parent_rows))
            if parent_names:
                scorecards = frappe.get_all(
                    "Performance Scorecard",
                    filters={"name": ["in", parent_names]},
                    fields=["name", "status", "start_date", "end_date", "overall_score"],
                    order_by="modified desc",
                    limit=10,
                )

        response["personal"]["scorecards"] = scorecards
        if selected_department and not selected_employee:
            response["personal"]["updates"] = []
        elif selected_employee and selected_employee != session_employee:
            response["personal"]["updates"] = []
        else:
            response["personal"]["updates"] = frappe.get_all(
                "Performance Update",
                filters={"owner": session_user},
                fields=["name", "kpi", "actual_value", "status", "modified"],
                order_by="modified desc",
                limit=10,
            )
            _enrich_updates(response["personal"]["updates"])

        latest_scorecard = scorecards[0].name if scorecards else frappe.db.get_value(
            "Performance Scorecard",
            scorecard_filters,
            "name",
            order_by="modified desc",
        )
        if latest_scorecard:
            doc = frappe.get_doc("Performance Scorecard", latest_scorecard)
            for item in doc.items:
                kpi_doc = frappe.get_value(
                    "KPI Master",
                    item.kpi,
                    ["kpi_name", "direction", "baseline"],
                    as_dict=True,
                )
                green = 90
                yellow = 50
                score = item.score or 0
                if score >= green:
                    rating = "On Track"
                elif score >= yellow:
                    rating = "At Risk"
                else:
                    rating = "Off Track"

                response["rows"].append(
                    {
                        "item_name": item.name,
                        "scorecard": latest_scorecard,
                        "kpa": item.kpa,
                        "goal": item.goal,
                        "kra": item.kra,
                        "kpi": item.kpi,
                        "kpi_name": (kpi_doc or {}).get("kpi_name") or item.kpi,
                        "kpi_direction": (kpi_doc or {}).get("direction") or "Increase",
                        "kpi_baseline": (kpi_doc or {}).get("baseline"),
                        "weightage": item.weightage,
                        "target": item.target,
                        "actual": item.actual,
                        "base_actual": getattr(item, "base_actual", None),
                        "score": score,
                        "rating": rating,
                    }
                )

    response["rollups"] = _build_rollups(level, selected_employee, filters.get("department"), session_user)
    if level == "Company":
        response["company"] = _build_company_rollups()
    return response


@frappe.whitelist()
def preview_company_kpa_import(file_url=None):
    rows = _parse_company_kpa_file(file_url)
    return _build_preview_response(
        rows,
        headers=["Row", "Action", "Status", "Message", "KPA Name", "Weightage"],
        field_map={
            "Row": "row",
            "Action": "action",
            "Status": "status",
            "Message": "message",
            "KPA Name": "kpa_name",
            "Weightage": "weightage",
        },
    )


@frappe.whitelist()
def preview_company_goal_import(file_url=None):
    rows = _parse_company_goal_file(file_url)
    return _build_preview_response(
        rows,
        headers=["Row", "Action", "Status", "Message", "Goal Name", "KPA", "Weightage", "Start Date", "End Date", "Status Label"],
        field_map={
            "Row": "row",
            "Action": "action",
            "Status": "status",
            "Message": "message",
            "Goal Name": "goal_name",
            "KPA": "kpa",
            "Weightage": "weightage",
            "Start Date": "start_date",
            "End Date": "end_date",
            "Status Label": "status_label",
        },
    )


@frappe.whitelist()
def preview_department_goal_import(file_url=None, department=None):
    rows = _parse_department_goal_file(file_url, department)
    return _build_preview_response(
        rows,
        headers=["Row", "Action", "Status", "Message", "Goal Name", "Owner Type", "Department", "Parent Goal", "Weightage", "Start Date", "End Date", "Status Label"],
        field_map={
            "Row": "row",
            "Action": "action",
            "Status": "status",
            "Message": "message",
            "Goal Name": "goal_name",
            "Owner Type": "owner_type",
            "Department": "department",
            "Parent Goal": "parent_goal",
            "Weightage": "weightage",
            "Start Date": "start_date",
            "End Date": "end_date",
            "Status Label": "status_label",
        },
    )


@frappe.whitelist()
def preview_department_kra_import(file_url=None, department=None):
    rows = _parse_department_kra_file(file_url, department)
    return _build_preview_response(
        rows,
        headers=["Row", "Action", "Status", "Message", "KRA Name", "Goal", "Owner Type", "Department", "Weightage", "Priority"],
        field_map={
            "Row": "row",
            "Action": "action",
            "Status": "status",
            "Message": "message",
            "KRA Name": "kra_name",
            "Goal": "goal",
            "Owner Type": "owner_type",
            "Department": "department",
            "Weightage": "weightage",
            "Priority": "priority",
        },
    )


@frappe.whitelist()
def preview_employee_goal_import(file_url=None, employee=None):
    rows = _parse_employee_goal_file(file_url, employee)
    return _build_preview_response(
        rows,
        headers=["Row", "Action", "Status", "Message", "Goal Name", "Owner Type", "Employee", "Parent Goal", "Parent KRA", "Weightage", "Start Date", "End Date", "Status Label"],
        field_map={
            "Row": "row",
            "Action": "action",
            "Status": "status",
            "Message": "message",
            "Goal Name": "goal_name",
            "Owner Type": "owner_type",
            "Employee": "employee",
            "Parent Goal": "parent_goal",
            "Parent KRA": "parent_kra",
            "Weightage": "weightage",
            "Start Date": "start_date",
            "End Date": "end_date",
            "Status Label": "status_label",
        },
    )


@frappe.whitelist()
def preview_employee_kra_import(file_url=None, employee=None):
    rows = _parse_employee_kra_file(file_url, employee)
    return _build_preview_response(
        rows,
        headers=["Row", "Action", "Status", "Message", "KRA Name", "Goal", "Owner Type", "Employee", "Parent KRA", "Weightage", "Priority"],
        field_map={
            "Row": "row",
            "Action": "action",
            "Status": "status",
            "Message": "message",
            "KRA Name": "kra_name",
            "Goal": "goal",
            "Owner Type": "owner_type",
            "Employee": "employee",
            "Parent KRA": "parent_kra",
            "Weightage": "weightage",
            "Priority": "priority",
        },
    )


@frappe.whitelist()
def preview_employee_kpi_import(file_url=None, employee=None):
    rows = _parse_employee_kpi_file(file_url, employee)
    return _build_preview_response(
        rows,
        headers=["Row", "Action", "Status", "Message", "KPI Name", "KRA", "Employee", "Unit", "Direction", "Baseline", "Calculation Method", "Description"],
        field_map={
            "Row": "row",
            "Action": "action",
            "Status": "status",
            "Message": "message",
            "KPI Name": "kpi_name",
            "KRA": "kra",
            "Employee": "employee",
            "Unit": "unit",
            "Direction": "direction",
            "Baseline": "baseline",
            "Calculation Method": "calculation_method",
            "Description": "description",
        },
    )

@frappe.whitelist()
def import_company_kpa(file_url=None):
    rows = _parse_company_kpa_file(file_url)
    created = updated = skipped = 0
    company = frappe.defaults.get_user_default("Company")

    for row in rows:
        if row.get("errors"):
            skipped += 1
            continue

        values = {
            "doctype": "KPA Master",
            "kpa_name": row["kpa_name"],
            "weightage": row.get("weightage"),
            "company": company,
        }
        if row.get("exists"):
            doc = frappe.get_doc("KPA Master", row["name"])
            doc.update(values)
            doc.save(ignore_permissions=True)
            updated += 1
        else:
            doc = frappe.get_doc(values)
            doc.insert(ignore_permissions=True)
            created += 1

    return {"created": created, "updated": updated, "skipped": skipped}


@frappe.whitelist()
def import_company_goals(file_url=None):
    rows = _parse_company_goal_file(file_url)
    created = updated = skipped = 0
    company = frappe.defaults.get_user_default("Company")

    for row in rows:
        if row.get("errors"):
            skipped += 1
            continue

        values = {
            "doctype": "Goal Master",
            "goal_name": row["goal_name"],
            "owner_type": "Company",
            "kpa": row["kpa"],
            "weightage": row.get("weightage"),
            "start_date": row.get("start_date"),
            "end_date": row.get("end_date"),
            "status": row.get("status_label") or "Draft",
            "company": company,
        }

        if row.get("exists"):
            doc = frappe.get_doc("Goal Master", row["name"])
            doc.update(values)
            doc.save(ignore_permissions=True)
            updated += 1
        else:
            doc = frappe.get_doc(values)
            doc.insert(ignore_permissions=True)
            created += 1

    return {"created": created, "updated": updated, "skipped": skipped}


@frappe.whitelist()
def import_department_goals(file_url=None, department=None):
    rows = _parse_department_goal_file(file_url, department)
    created = updated = skipped = 0

    for row in rows:
        if row.get("errors"):
            skipped += 1
            continue
        
        dept = row.get("department")
        company = frappe.db.get_value("Department", dept, "company") if dept else frappe.defaults.get_user_default("Company")

        values = {
            "doctype": "Goal Master",
            "goal_name": row["goal_name"],
            "owner_type": "Department",
            "department": dept,
            "parent_goal": row.get("parent_goal"),
            "weightage": row.get("weightage"),
            "start_date": row.get("start_date"),
            "end_date": row.get("end_date"),
            "status": row.get("status_label") or "Draft",
            "company": company,
        }

        if row.get("exists"):
            doc = frappe.get_doc("Goal Master", row["name"])
            doc.update(values)
            doc.save(ignore_permissions=True)
            updated += 1
        else:
            doc = frappe.get_doc(values)
            doc.insert(ignore_permissions=True)
            created += 1

    return {"created": created, "updated": updated, "skipped": skipped}


@frappe.whitelist()
def import_department_kra(file_url=None, department=None):
    rows = _parse_department_kra_file(file_url, department)
    created = updated = skipped = 0

    for row in rows:
        if row.get("errors"):
            skipped += 1
            continue

        dept = row.get("department")
        company = frappe.db.get_value("Department", dept, "company") if dept else frappe.defaults.get_user_default("Company")

        values = {
            "doctype": "KRA Master",
            "kra_name": row["kra_name"],
            "goal": row.get("goal"),
            "owner_type": "Department",
            "department": dept,
            "weightage": row.get("weightage"),
            "priority": row.get("priority"),
            "company": company,
        }

        if row.get("exists"):
            doc = frappe.get_doc("KRA Master", row["name"])
            doc.update(values)
            doc.save(ignore_permissions=True)
            updated += 1
        else:
            doc = frappe.get_doc(values)
            doc.insert(ignore_permissions=True)
            created += 1

    return {"created": created, "updated": updated, "skipped": skipped}


@frappe.whitelist()
def import_employee_goals(file_url=None, employee=None):
    rows = _parse_employee_goal_file(file_url, employee)
    created = updated = skipped = 0

    for row in rows:
        if row.get("errors"):
            skipped += 1
            continue
        
        emp = row.get("employee")
        company = frappe.db.get_value("Employee", emp, "company") if emp else frappe.defaults.get_user_default("Company")

        values = {
            "doctype": "Goal Master",
            "goal_name": row["goal_name"],
            "owner_type": "Employee",
            "employee": emp,
            "department": row.get("department") or frappe.db.get_value("Employee", emp, "department"),
            "parent_goal": row.get("parent_goal"),
            "parent_kra": row.get("parent_kra"),
            "weightage": row.get("weightage"),
            "start_date": row.get("start_date"),
            "end_date": row.get("end_date"),
            "status": row.get("status_label") or "Draft",
            "company": company,
        }

        if row.get("exists"):
            doc = frappe.get_doc("Goal Master", row["name"])
            doc.update(values)
            doc.save(ignore_permissions=True)
            updated += 1
        else:
            doc = frappe.get_doc(values)
            doc.insert(ignore_permissions=True)
            created += 1

    return {"created": created, "updated": updated, "skipped": skipped}


@frappe.whitelist()
def import_employee_kra(file_url=None, employee=None):
    rows = _parse_employee_kra_file(file_url, employee)
    created = updated = skipped = 0

    for row in rows:
        if row.get("errors"):
            skipped += 1
            continue

        emp = row.get("employee")
        company = frappe.db.get_value("Employee", emp, "company") if emp else frappe.defaults.get_user_default("Company")

        values = {
            "doctype": "KRA Master",
            "kra_name": row["kra_name"],
            "goal": row.get("goal"),
            "owner_type": "Employee",
            "employee": emp,
            "department": row.get("department") or frappe.db.get_value("Employee", emp, "department"),
            "parent_kra": row.get("parent_kra"),
            "weightage": row.get("weightage"),
            "priority": row.get("priority"),
            "company": company,
        }

        if row.get("exists"):
            doc = frappe.get_doc("KRA Master", row["name"])
            doc.update(values)
            doc.save(ignore_permissions=True)
            updated += 1
        else:
            doc = frappe.get_doc(values)
            doc.insert(ignore_permissions=True)
            created += 1

    return {"created": created, "updated": updated, "skipped": skipped}


@frappe.whitelist()
def import_employee_kpi(file_url=None, employee=None):
    from performance_scorecard.performance_scorecard.doctype.performance_scorecard.performance_scorecard import add_kpi_to_active_scorecard
    rows = _parse_employee_kpi_file(file_url, employee)
    created = updated = skipped = 0

    for row in rows:
        if row.get("errors"):
            skipped += 1
            continue

        emp = row.get("employee")
        company = frappe.db.get_value("Employee", emp, "company") if emp else frappe.defaults.get_user_default("Company")

        values = {
            "doctype": "KPI Master",
            "kpi_name": row["kpi_name"],
            "kra": row.get("kra"),
            "employee": emp,
            "unit": row.get("unit"),
            "direction": row.get("direction"),
            "baseline": row.get("baseline"),
            "calculation_method": row.get("calculation_method"),
            "description": row.get("description"),
            "company": company,
        }

        if row.get("exists"):
            doc = frappe.get_doc("KPI Master", row["name"])
            doc.update(values)
            doc.save(ignore_permissions=True)
            updated += 1
        else:
            doc = frappe.get_doc(values)
            doc.insert(ignore_permissions=True)
            created += 1
        
        # Explicitly update scorecard for good measure, though after_insert should handle it
        add_kpi_to_active_scorecard(values["employee"], doc.name)

    return {"created": created, "updated": updated, "skipped": skipped}

@frappe.whitelist()
def download_company_kpa_template(format="xlsx"):
    headers = ["kpa_name", "weightage"]
    data = [headers, ["Customer", 25]]
    filename = "company_kpa_template"
    if format == "xlsx":
        build_xlsx_response(data, filename)
    else:
        frappe.throw("Only xlsx format is supported.")


@frappe.whitelist()
def download_company_goal_template(format="xlsx"):
    headers = ["goal_name", "kpa", "weightage", "start_date", "end_date", "status", "owner_type"]
    data = [headers, ["Increase customer retention", "Customer", 50, "2025-01-01", "2025-12-31", "Active", "Company"]]
    filename = "company_goal_template"
    if format == "xlsx":
        build_xlsx_response(data, filename)
    else:
        frappe.throw("Only xlsx format is supported.")


@frappe.whitelist()
def download_department_goal_template(format="xlsx"):
    headers = ["goal_name", "owner_type", "department", "parent_goal", "weightage", "start_date", "end_date", "status"]
    data = [headers, ["Improve support response time", "Department", "Support", "Increase customer retention", 40, "2025-01-01", "2025-12-31", "Active"]]
    filename = "department_goal_template"
    if format == "xlsx":
        build_xlsx_response(data, filename)
    else:
        frappe.throw("Only xlsx format is supported.")


@frappe.whitelist()
def download_department_kra_template(format="xlsx"):
    headers = ["kra_name", "goal", "owner_type", "department", "weightage", "priority"]
    data = [headers, ["Reduce ticket backlog", "Improve support response time", "Department", "Support", 50, "Medium"]]
    filename = "department_kra_template"
    if format == "xlsx":
        build_xlsx_response(data, filename)
    else:
        frappe.throw("Only xlsx format is supported.")


@frappe.whitelist()
def download_employee_goal_template(format="xlsx"):
    headers = ["goal_name", "owner_type", "employee", "parent_goal", "parent_kra", "weightage", "start_date", "end_date", "status"]
    data = [headers, ["Improve onboarding quality", "Employee", "EMP-0001", "Increase customer retention", "", 30, "2025-01-01", "2025-12-31", "Active"]]
    filename = "employee_goal_template"
    if format == "xlsx":
        build_xlsx_response(data, filename)
    else:
        frappe.throw("Only xlsx format is supported.")


@frappe.whitelist()
def download_employee_kra_template(format="xlsx"):
    headers = ["kra_name", "goal", "owner_type", "employee", "parent_kra", "weightage", "priority"]
    data = [headers, ["Reduce onboarding time", "Improve onboarding quality", "Employee", "EMP-0001", "", 50, "Medium"]]
    filename = "employee_kra_template"
    if format == "xlsx":
        build_xlsx_response(data, filename)
    else:
        frappe.throw("Only xlsx format is supported.")


@frappe.whitelist()
def download_employee_kpi_template(format="xlsx"):
    headers = ["kpi_name", "kra", "employee", "unit", "direction", "baseline", "calculation_method", "description"]
    data = [headers, ["Onboarding satisfaction score", "Reduce onboarding time", "EMP-0001", "Rating", "Increase", "", "Manual", "Monthly survey rating"]]
    filename = "employee_kpi_template"
    if format == "xlsx":
        build_xlsx_response(data, filename)
    else:
        frappe.throw("Only xlsx format is supported.")


@frappe.whitelist()
def export_company_kpa(format="xlsx"):
    rows = frappe.get_all("KPA Master", fields=["name", "kpa_name", "weightage"], order_by="kpa_name asc")
    data = [["kpa_name", "weightage"]]
    for row in rows:
        data.append([row.kpa_name, row.weightage])
    _build_export_response(data, "company_kpa_export", format)


@frappe.whitelist()
def export_company_goals(format="xlsx"):
    goals = frappe.get_all(
        "Goal Master",
        filters={"owner_type": "Company"},
        fields=["name", "goal_name", "kpa", "weightage", "start_date", "end_date", "status", "owner_type"],
        order_by="goal_name asc",
    )
    kpa_map = _get_kpa_name_map([g.kpa for g in goals if g.kpa])
    data = [["goal_name", "kpa", "weightage", "start_date", "end_date", "status", "owner_type"]]
    for goal in goals:
        data.append(
            [
                goal.goal_name,
                kpa_map.get(goal.kpa, goal.kpa),
                goal.weightage,
                goal.start_date,
                goal.end_date,
                goal.status,
                goal.owner_type,
            ]
        )
    _build_export_response(data, "company_goal_export", format)


@frappe.whitelist()
def export_department_goals(format="xlsx", department=None):
    if not department:
        frappe.throw("Department is required.")
    goals = frappe.get_all(
        "Goal Master",
        filters={"owner_type": "Department", "department": department},
        fields=["name", "goal_name", "parent_goal", "weightage", "start_date", "end_date", "status", "owner_type", "department"],
        order_by="goal_name asc",
    )
    data = [["goal_name", "owner_type", "department", "parent_goal", "weightage", "start_date", "end_date", "status"]]
    for goal in goals:
        data.append(
            [
                goal.goal_name,
                goal.owner_type,
                goal.department,
                goal.parent_goal,
                goal.weightage,
                goal.start_date,
                goal.end_date,
                goal.status,
            ]
        )
    _build_export_response(data, f"department_goal_export_{department}", format)


@frappe.whitelist()
def export_department_kra(format="xlsx", department=None):
    if not department:
        frappe.throw("Department is required.")
    kras = frappe.get_all(
        "KRA Master",
        filters={"owner_type": "Department", "department": department},
        fields=["name", "kra_name", "goal", "owner_type", "department", "weightage", "priority"],
        order_by="kra_name asc",
    )
    data = [["kra_name", "goal", "owner_type", "department", "weightage", "priority"]]
    for kra in kras:
        data.append(
            [
                kra.kra_name,
                kra.goal,
                kra.owner_type,
                kra.department,
                kra.weightage,
                kra.priority,
            ]
        )
    _build_export_response(data, f"department_kra_export_{department}", format)


@frappe.whitelist()
def export_employee_goals(format="xlsx", employee=None):
    if not employee:
        frappe.throw("Employee is required.")
    goals = frappe.get_all(
        "Goal Master",
        filters={"owner_type": "Employee", "employee": employee},
        fields=["name", "goal_name", "parent_goal", "parent_kra", "weightage", "start_date", "end_date", "status", "owner_type", "employee"],
        order_by="goal_name asc",
    )
    data = [["goal_name", "owner_type", "employee", "parent_goal", "parent_kra", "weightage", "start_date", "end_date", "status"]]
    for goal in goals:
        data.append(
            [
                goal.goal_name,
                goal.owner_type,
                goal.employee,
                goal.parent_goal,
                goal.parent_kra,
                goal.weightage,
                goal.start_date,
                goal.end_date,
                goal.status,
            ]
        )
    _build_export_response(data, f"employee_goal_export_{employee}", format)


@frappe.whitelist()
def export_employee_kra(format="xlsx", employee=None):
    if not employee:
        frappe.throw("Employee is required.")
    kras = frappe.get_all(
        "KRA Master",
        filters={"owner_type": "Employee", "employee": employee},
        fields=["name", "kra_name", "goal", "owner_type", "employee", "parent_kra", "weightage", "priority"],
        order_by="kra_name asc",
    )
    data = [["kra_name", "goal", "owner_type", "employee", "parent_kra", "weightage", "priority"]]
    for kra in kras:
        data.append(
            [
                kra.kra_name,
                kra.goal,
                kra.owner_type,
                kra.employee,
                kra.parent_kra,
                kra.weightage,
                kra.priority,
            ]
        )
    _build_export_response(data, f"employee_kra_export_{employee}", format)


@frappe.whitelist()
def export_employee_kpi(format="xlsx", employee=None):
    if not employee:
        frappe.throw("Employee is required.")
    kpis = frappe.get_all(
        "KPI Master",
        filters={"employee": employee},
        fields=[
            "name",
            "kpi_name",
            "kra",
            "employee",
            "unit",
            "direction",
            "baseline",
            "calculation_method",
            "description",
        ],
        order_by="kpi_name asc",
    )
    data = [["kpi_name", "kra", "employee", "unit", "direction", "baseline", "calculation_method", "description"]]
    for kpi in kpis:
        data.append(
            [
                kpi.kpi_name,
                kpi.kra,
                kpi.employee,
                kpi.unit,
                kpi.direction,
                kpi.baseline,
                kpi.calculation_method,
                kpi.description,
            ]
        )
    _build_export_response(data, f"employee_kpi_export_{employee}", format)


def _enrich_updates(updates):
    if not updates:
        return

    kpis = [u.get("kpi") for u in updates if u.get("kpi")]
    kpi_map = {}
    if kpis:
        for row in frappe.get_all(
            "KPI Master",
            filters={"name": ["in", list(set(kpis))]},
            fields=["name", "kpi_name"],
        ):
            kpi_map[row.name] = row

    for update in updates:
        kpi = update.get("kpi")
        kpi_doc = kpi_map.get(kpi) or {}
        green = 90
        yellow = 50
        actual = update.get("actual_value") or 0

        if actual >= green:
            status = "On Track"
            color = "green"
        elif actual >= yellow:
            status = "At Risk"
            color = "yellow"
        else:
            status = "Off Track"
            color = "red"

        update["kpi_name"] = kpi_doc.get("kpi_name") or kpi
        update["threshold_green"] = green
        update["threshold_yellow"] = yellow
        update["status_label"] = status
        update["status_color"] = color


def _get_scorecard_filters(level, employee, department, session_user):
    filters = {"docstatus": ["in", [0, 1]]}
    if level == "Department" and department:
        filters["department"] = department
    elif level == "Individual":
        if employee:
            if isinstance(employee, (list, tuple)):
                filters["employee"] = ["in", list(employee)]
            else:
                filters["employee"] = employee
        else:
            filters["owner"] = session_user
    return filters


def _get_kpis_for_kra(kra_name, scorecard_filters=None, employee_filter=None):
    filters = {"kra": kra_name}
    if employee_filter:
        if isinstance(employee_filter, (list, tuple)):
            filters["employee"] = ["in", list(employee_filter)]
        else:
            filters["employee"] = employee_filter

    kpi_rows = frappe.get_all(
        "KPI Master",
        filters=filters,
        fields=["name", "kpi_name"],
    )

    if not kpi_rows:
        return []

    item_map = {}
    if scorecard_filters:
        scorecards = frappe.get_all(
            "Performance Scorecard",
            filters=scorecard_filters,
            pluck="name"
        )
        if scorecards:
            items = frappe.get_all(
                "Scorecard Item",
                filters={"parent": ["in", scorecards], "kra": kra_name},
                fields=["kpi", "target", "actual", "score"]
            )
            for item in items:
                score = item.score
                if score is None and item.target not in (None, 0):
                    score = (item.actual or 0) / item.target * 100
                item_map[item.kpi] = {
                    "target": item.target,
                    "actual": item.actual,
                    "score": score,
                }

    kpis = []
    for row in kpi_rows:
        item = item_map.get(row.name, {})
        kpis.append(
            {
                "kpi": row.name,
                "kpi_name": row.kpi_name,
                "target": item.get("target"),
                "actual": item.get("actual"),
                "score": item.get("score"),
            }
        )

    return kpis


def _build_rollups(level, employee, department, session_user):
    if level == "Department" and department:
        return _build_department_rollups(department)

    filters = {}
    if level == "Individual":
        if employee:
            if isinstance(employee, (list, tuple)):
                filters["employee"] = ["in", list(employee)]
            else:
                filters["employee"] = employee
        elif department:
            dept_employees = frappe.get_all(
                "Employee",
                filters={"department": department},
                pluck="name",
            )
            if dept_employees:
                filters["employee"] = ["in", dept_employees]
            else:
                filters["employee"] = "__none__"
        else:
            filters["owner"] = session_user

    scorecards = frappe.get_all("Performance Scorecard", filters=filters, pluck="name")
    if not scorecards:
        return {"kpas": [], "overall_score": 0}

    items = frappe.get_all(
        "Scorecard Item",
        filters={"parent": ["in", scorecards]},
        fields=["name", "kpa", "goal", "kra", "kpi", "weightage", "score", "target", "actual", "parent"],
    )

    goal_names = list({i.goal for i in items if i.goal})
    goal_parent = {}
    goal_kpa = {}
    if goal_names:
        for row in frappe.get_all(
            "Goal Master",
            filters={"name": ["in", goal_names]},
            fields=["name", "parent_goal", "kpa"],
        ):
            goal_parent[row.name] = row.parent_goal
            goal_kpa[row.name] = row.kpa

        if level == "Department":
            dept_goal_names = [g for g in goal_parent.values() if g]
            if dept_goal_names:
                for row in frappe.get_all(
                    "Goal Master",
                    filters={"name": ["in", list(set(dept_goal_names))]},
                    fields=["name", "kpa"],
                ):
                    goal_kpa[row.name] = row.kpa

    kra_parent = {}
    if level == "Department":
        kra_names = list({i.kra for i in items if i.kra})
        if kra_names:
            for row in frappe.get_all(
                "KRA Master",
                filters={"name": ["in", kra_names]},
                fields=["name", "parent_kra"],
            ):
                if row.parent_kra:
                    kra_parent[row.name] = row.parent_kra

    rollup = {}
    for item in items:
        goal_name = item.goal
        if level == "Department":
            goal_name = goal_parent.get(item.goal) or item.goal

        kpa = item.kpa or goal_kpa.get(goal_name) or goal_kpa.get(item.goal)
        if not kpa:
            kpa = "Unassigned"

        rollup.setdefault(kpa, {"goals": {}})
        goal_bucket = rollup[kpa]["goals"].setdefault(
            goal_name,
            {"kras": {}},
        )
        kra_name = kra_parent.get(item.kra) if level == "Department" else item.kra
        if not kra_name:
            continue
        kra_bucket = goal_bucket["kras"].setdefault(
            kra_name,
            {"items": []},
        )

        kra_bucket["items"].append(
            {
                "score": item.score or 0,
            }
        )

    kpa_rows = []
    overall_sum = 0
    overall_count = 0
    for kpa, data in rollup.items():
        goal_rows = []
        kpa_sum = 0
        kpa_count = 0
        for goal_name, goal_data in data["goals"].items():
            kra_rows = []
            goal_sum = 0
            goal_count = 0
            for kra_name, kra_data in goal_data["kras"].items():
                item_scores = [i["score"] for i in kra_data["items"]]
                kra_avg = sum(item_scores) / len(item_scores) if item_scores else 0

                kra_rows.append(
                    {
                        "kra": kra_name,
                        "average_score": kra_avg,
                        "weightage": 0,
                    }
                )
                goal_sum += kra_avg
                goal_count += 1

            goal_avg = goal_sum / goal_count if goal_count else 0
            goal_rows.append(
                {
                    "goal": goal_name,
                    "average_score": goal_avg,
                    "weightage": 0,
                    "kras": kra_rows,
                }
            )
            kpa_sum += goal_avg
            kpa_count += 1

        kpa_avg = kpa_sum / kpa_count if kpa_count else 0
        overall_sum += kpa_avg
        overall_count += 1

        kpa_rows.append(
            {
                "kpa": kpa,
                "average_score": kpa_avg,
                "weightage": 0,
                "goals": goal_rows,
            }
        )

    overall_score = overall_sum / overall_count if overall_count else 0
    return {"kpas": kpa_rows, "overall_score": overall_score}


def _build_department_rollups(department):
    dept_goals = frappe.get_all(
        "Goal Master",
        filters={"owner_type": "Department", "department": department, "status": ["!=", "Archived"]},
        fields=["name", "kpa"],
    )
    if not dept_goals:
        return {"kpas": [], "overall_score": 0}

    dept_employees = frappe.get_all("Employee", filters={"department": department}, pluck="name")

    dept_goal_names = [g.name for g in dept_goals]
    dept_kras = frappe.get_all(
        "KRA Master",
        filters={"goal": ["in", dept_goal_names]},
        fields=["name", "goal"],
    )
    dept_kra_names = [k.name for k in dept_kras]

    child_kra_map = {}
    if dept_kra_names:
        child_filters = {"parent_kra": ["in", dept_kra_names], "owner_type": "Employee"}
        if dept_employees:
            child_filters["employee"] = ["in", dept_employees]
        child_kras = frappe.get_all("KRA Master", filters=child_filters, fields=["name", "parent_kra"])
        for row in child_kras:
            child_kra_map.setdefault(row.parent_kra, []).append(row.name)

    scorecard_names = set()
    if dept_employees:
        scorecard_names.update(
            frappe.get_all(
                "Performance Scorecard",
                filters={"employee": ["in", dept_employees]},
                pluck="name",
            )
        )
    scorecard_names.update(
        frappe.get_all(
            "Performance Scorecard",
            filters={"department": department},
            pluck="name",
        )
    )

    child_kra_scores = {}
    if scorecard_names and dept_kra_names:
        all_child_kras = [k for kids in child_kra_map.values() for k in kids]
        if all_child_kras:
            items = frappe.get_all(
                "Scorecard Item",
                filters={"parent": ["in", list(scorecard_names)], "kra": ["in", all_child_kras]},
                fields=["kra", "score", "target", "actual"],
            )
            for item in items:
                score = item.score
                if score is None and item.target not in (None, 0):
                    score = (item.actual or 0) / item.target * 100
                bucket = child_kra_scores.setdefault(item.kra, {"sum": 0, "count": 0})
                bucket["sum"] += score or 0
                bucket["count"] += 1

    dept_kra_scores = {}
    for kra in dept_kras:
        child_names = child_kra_map.get(kra.name) or []
        if not child_names:
            dept_kra_scores[kra.name] = 0
            continue
        child_avgs = []
        for child in child_names:
            bucket = child_kra_scores.get(child)
            if bucket and bucket.get("count"):
                child_avgs.append(bucket["sum"] / bucket["count"])
            else:
                child_avgs.append(0)
        dept_kra_scores[kra.name] = sum(child_avgs) / len(child_avgs) if child_avgs else 0

    goal_kra_map = {}
    for kra in dept_kras:
        goal_kra_map.setdefault(kra.goal, []).append(kra.name)

    goal_scores = {}
    for goal in dept_goals:
        kra_names = goal_kra_map.get(goal.name) or []
        if not kra_names:
            goal_scores[goal.name] = 0
            continue
        kra_avgs = [dept_kra_scores.get(name, 0) for name in kra_names]
        goal_scores[goal.name] = sum(kra_avgs) / len(kra_avgs) if kra_avgs else 0

    kpa_goal_map = {}
    for goal in dept_goals:
        kpa_goal_map.setdefault(goal.kpa or "Unassigned", []).append(goal.name)

    kpa_rows = []
    overall_sum = 0
    overall_count = 0
    for kpa, goals in kpa_goal_map.items():
        if not goals:
            continue
        goal_rows = []
        for goal_name in goals:
            kra_rows = []
            for kra_name in goal_kra_map.get(goal_name, []):
                kra_rows.append(
                    {
                        "kra": kra_name,
                        "average_score": dept_kra_scores.get(kra_name, 0),
                        "weightage": 0,
                    }
                )
            goal_rows.append(
                {
                    "goal": goal_name,
                    "average_score": goal_scores.get(goal_name, 0),
                    "weightage": 0,
                    "kras": kra_rows,
                }
            )

        kpa_avg = sum(goal_scores.get(name, 0) for name in goals) / len(goals)
        overall_sum += kpa_avg
        overall_count += 1
        kpa_rows.append(
            {
                "kpa": kpa,
                "average_score": kpa_avg,
                "weightage": 0,
                "goals": goal_rows,
            }
        )

    overall_score = overall_sum / overall_count if overall_count else 0
    return {"kpas": kpa_rows, "overall_score": overall_score}


def _build_company_rollups():
    # Company goals are parents; department goals are children (parent_goal).
    company_goals = frappe.get_all(
        "Goal Master",
        filters={"owner_type": "Company", "status": ["!=", "Archived"]},
        fields=["name", "goal_name", "kpa"],
    )
    if not company_goals:
        return {"kpas": [], "overall_score": 0}

    company_goal_names = [g.name for g in company_goals]
    dept_goals = frappe.get_all(
        "Goal Master",
        filters={"owner_type": "Department", "parent_goal": ["in", company_goal_names]},
        fields=["name", "goal_name", "parent_goal", "department"],
    )
    dept_goal_names = [g.name for g in dept_goals]
    dept_goal_department = {g.name: g.department for g in dept_goals}

    dept_kras = frappe.get_all(
        "KRA Master",
        filters={"goal": ["in", dept_goal_names]},
        fields=["name", "goal"],
    )
    dept_kra_names = [k.name for k in dept_kras]

    child_kras = []
    if dept_kra_names:
        child_kras = frappe.get_all(
            "KRA Master",
            filters={"parent_kra": ["in", dept_kra_names], "owner_type": "Employee"},
            fields=["name", "parent_kra", "department"],
        )
    child_kra_names = [k.name for k in child_kras]
    child_kra_department = {k.name: k.department for k in child_kras}

    departments = list({g.department for g in dept_goals if g.department})
    employee_departments = {}
    if departments:
        employee_rows = frappe.get_all(
            "Employee",
            filters={"department": ["in", departments]},
            fields=["name", "department"],
        )
        for row in employee_rows:
            employee_departments[row.name] = row.department

    scorecard_dept = {}
    scorecard_rows = []
    if departments:
        scorecard_rows = frappe.get_all(
            "Performance Scorecard",
            filters={"department": ["in", departments]},
            fields=["name", "department", "employee"],
        )
    if employee_departments:
        scorecard_rows += frappe.get_all(
            "Performance Scorecard",
            filters={"employee": ["in", list(employee_departments.keys())]},
            fields=["name", "department", "employee"],
        )
    for row in scorecard_rows:
        dept = row.department or employee_departments.get(row.employee)
        if dept:
            scorecard_dept[row.name] = dept

    child_kra_scores = {}
    if scorecard_dept and child_kra_names:
        items = frappe.get_all(
            "Scorecard Item",
            filters={"parent": ["in", list(scorecard_dept.keys())], "kra": ["in", child_kra_names]},
            fields=["kra", "score", "target", "actual", "parent"],
        )
        for item in items:
            dept = scorecard_dept.get(item.parent)
            if not dept:
                continue
            if child_kra_department.get(item.kra) and child_kra_department.get(item.kra) != dept:
                continue
            score = item.score
            if score is None and item.target not in (None, 0):
                score = (item.actual or 0) / item.target * 100
            bucket = child_kra_scores.setdefault(item.kra, {"sum": 0, "count": 0})
            bucket["sum"] += score or 0
            bucket["count"] += 1

    child_kra_avg = {
        name: (bucket["sum"] / bucket["count"]) if bucket.get("count") else 0
        for name, bucket in child_kra_scores.items()
    }

    dept_kra_scores = {}
    child_by_parent = {}
    for child in child_kras:
        child_by_parent.setdefault(child.parent_kra, []).append(child.name)
    for kra in dept_kras:
        child_names = child_by_parent.get(kra.name) or []
        if not child_names:
            dept_kra_scores[kra.name] = 0
            continue
        child_avgs = [child_kra_avg.get(name, 0) for name in child_names]
        dept_kra_scores[kra.name] = sum(child_avgs) / len(child_avgs) if child_avgs else 0

    goal_kra_map = {}
    for kra in dept_kras:
        goal_kra_map.setdefault(kra.goal, []).append(kra.name)

    dept_goal_scores = {}
    for goal in dept_goals:
        kra_names = goal_kra_map.get(goal.name) or []
        if not kra_names:
            dept_goal_scores[goal.name] = 0
            continue
        kra_avgs = [dept_kra_scores.get(name, 0) for name in kra_names]
        dept_goal_scores[goal.name] = sum(kra_avgs) / len(kra_avgs) if kra_avgs else 0

    goal_rows = {}
    for goal in company_goals:
        children = [g for g in dept_goals if g.parent_goal == goal.name]
        dept_contrib = []
        for child in children:
            dept = dept_goal_department.get(child.name)
            dept_contrib.append(
                {
                    "department": dept,
                    "average_score": dept_goal_scores.get(child.name, 0),
                    "weightage": 0,
                }
            )

        dept_contrib.sort(key=lambda d: d.get("average_score") or 0, reverse=True)
        worst_dept = dept_contrib[-1] if dept_contrib else None

        goal_avg = 0
        if dept_contrib:
            goal_avg = sum(d.get("average_score") or 0 for d in dept_contrib) / len(dept_contrib)

        goal_rows[goal.name] = {
            "goal_id": goal.name,
            "goal": goal.goal_name,
            "goal_name": goal.goal_name,
            "weightage": 0,
            "kpa": goal.kpa,
            "avg_dept_weightage": 0,
            "department_contributions": dept_contrib,
            "worst_department": worst_dept,
            "average_score": goal_avg,
        }

    kpa_groups = {}
    for goal in company_goals:
        kpa = goal.kpa or "Unassigned"
        kpa_groups.setdefault(kpa, []).append(goal_rows.get(goal.name))

    kpa_rows = []
    overall_sum = 0
    overall_count = 0
    for kpa, goals in kpa_groups.items():
        if not goals:
            continue
        kpa_avg = sum(g.get("average_score") or 0 for g in goals) / len(goals)
        overall_sum += kpa_avg
        overall_count += 1

        kpa_rows.append(
            {
                "kpa": kpa,
                "average_score": kpa_avg,
                "weightage": 0,
                "goals": goals,
            }
        )

    overall_score = overall_sum / overall_count if overall_count else 0
    return {"kpas": kpa_rows, "overall_score": overall_score}


def _parse_company_kpa_file(file_url):
    rows = _read_import_file(file_url)
    header_map = {
        "kpa_name": {"kpa", "kpa_name", "kpa master", "kpa master name", "kpa name", "name"},
        "weightage": {"weightage", "weight", "weightage_percent", "weightage_pct"},
    }
    required = {"kpa_name"}
    return _parse_import_rows(rows, header_map, required, doctype="KPA Master")


def _parse_company_goal_file(file_url):
    rows = _read_import_file(file_url)
    header_map = {
        "goal_name": {"goal", "goal_name", "goal name", "name"},
        "kpa": {"kpa", "kpa_name", "kpa master", "kpa master name", "kpa name"},
        "weightage": {"weightage", "weight", "weightage_percent", "weightage_pct"},
        "start_date": {"start_date", "start date"},
        "end_date": {"end_date", "end date"},
        "status_label": {"status", "status_label"},
        "owner_type": {"owner_type", "owner type"},
    }
    required = {"goal_name", "kpa"}
    return _parse_import_rows(
        rows,
        header_map,
        required,
        doctype="Goal Master",
        context={"expected_owner_type": "Company", "default_owner_type": "Company"},
    )


def _parse_department_goal_file(file_url, department=None):
    rows = _read_import_file(file_url)
    header_map = {
        "goal_name": {"goal", "goal_name", "goal name", "name"},
        "owner_type": {"owner_type", "owner type"},
        "department": {"department"},
        "parent_goal": {"parent_goal", "parent goal"},
        "weightage": {"weightage", "weight", "weightage_percent", "weightage_pct"},
        "start_date": {"start_date", "start date"},
        "end_date": {"end_date", "end date"},
        "status_label": {"status", "status_label"},
    }
    required = {"goal_name", "owner_type", "parent_goal"}
    return _parse_import_rows(
        rows,
        header_map,
        required,
        doctype="Goal Master",
        context={"expected_owner_type": "Department", "default_department": department},
    )


def _parse_department_kra_file(file_url, department=None):
    rows = _read_import_file(file_url)
    header_map = {
        "kra_name": {"kra", "kra_name", "kra name", "name"},
        "goal": {"goal", "goal_name", "goal name"},
        "owner_type": {"owner_type", "owner type"},
        "department": {"department"},
        "weightage": {"weightage", "weight", "weightage_percent", "weightage_pct"},
        "priority": {"priority"},
    }
    required = {"kra_name", "goal", "owner_type"}
    return _parse_import_rows(
        rows,
        header_map,
        required,
        doctype="KRA Master",
        context={"expected_owner_type": "Department", "default_department": department},
    )


def _parse_employee_goal_file(file_url, employee=None):
    rows = _read_import_file(file_url)
    header_map = {
        "goal_name": {"goal", "goal_name", "goal name", "name"},
        "owner_type": {"owner_type", "owner type"},
        "employee": {"employee", "owner", "owner_employee"},
        "parent_goal": {"parent_goal", "parent goal"},
        "parent_kra": {"parent_kra", "parent kra"},
        "weightage": {"weightage", "weight", "weightage_percent", "weightage_pct"},
        "start_date": {"start_date", "start date"},
        "end_date": {"end_date", "end date"},
        "status_label": {"status", "status_label"},
    }
    required = {"goal_name", "owner_type"}
    return _parse_import_rows(
        rows,
        header_map,
        required,
        doctype="Goal Master",
        context={
            "expected_owner_type": "Employee",
            "default_owner_type": "Employee",
            "default_employee": employee,
        },
    )


def _parse_employee_kra_file(file_url, employee=None):
    rows = _read_import_file(file_url)
    header_map = {
        "kra_name": {"kra", "kra_name", "kra name", "name"},
        "goal": {"goal", "goal_name", "goal name"},
        "owner_type": {"owner_type", "owner type"},
        "employee": {"employee", "owner", "owner_employee"},
        "parent_kra": {"parent_kra", "parent kra"},
        "weightage": {"weightage", "weight", "weightage_percent", "weightage_pct"},
        "priority": {"priority"},
    }
    required = {"kra_name", "goal", "owner_type"}
    return _parse_import_rows(
        rows,
        header_map,
        required,
        doctype="KRA Master",
        context={
            "expected_owner_type": "Employee",
            "default_owner_type": "Employee",
            "default_employee": employee,
        },
    )


def _parse_employee_kpi_file(file_url, employee=None):
    rows = _read_import_file(file_url)
    header_map = {
        "kpi_name": {"kpi", "kpi_name", "kpi name", "name"},
        "kra": {"kra", "kra_name", "kra name"},
        "employee": {"employee", "owner", "owner_employee"},
        "unit": {"unit"},
        "direction": {"direction", "trend"},
        "baseline": {"baseline", "baseline_value", "start_value", "start value"},
        "calculation_method": {"calculation_method", "calculation method"},
        "description": {"description"},
    }
    required = {"kpi_name"}
    return _parse_import_rows(
        rows,
        header_map,
        required,
        doctype="KPI Master",
        context={"default_employee": employee},
    )


def _read_import_file(file_url):
    if not file_url:
        frappe.throw("File is required.")

    extension = cstr(file_url).split(".")[-1].lower()
    if extension in {"xlsx", "xls"}:
        return read_xlsx_file_from_attached_file(file_url=file_url) or []
    if extension == "csv":
        file_doc = frappe.get_doc("File", {"file_url": file_url})
        content = file_doc.get_content()
        return read_csv_content(content) or []

    frappe.throw("Unsupported file type. Upload CSV or XLSX.")


def _parse_import_rows(rows, header_map, required_fields, doctype, context=None):
    if not rows:
        return []

    header_row = rows[0] or []
    headers = [_normalize_header(h) for h in header_row]
    index_to_field = _map_header_fields(headers, header_map)

    parsed_rows = []
    for idx, row in enumerate(rows[1:], start=2):
        if not row or not any([cstr(v).strip() for v in row]):
            continue

        values = {field: _coerce_value(field, row[i]) for i, field in index_to_field.items()}
        errors = _validate_import_row(values, required_fields, doctype, context=context)

        if doctype == "KPA Master":
            kpa_name = values.get("kpa_name")
            exists = bool(kpa_name and frappe.db.exists("KPA Master", kpa_name))
            name = kpa_name if exists else None
        elif doctype == "Goal Master":
            goal_name = values.get("goal_name")
            exists = bool(goal_name and frappe.db.exists("Goal Master", goal_name))
            name = goal_name if exists else None
        elif doctype == "KPI Master":
            kpi_name = values.get("kpi_name")
            exists = bool(kpi_name and frappe.db.exists("KPI Master", kpi_name))
            name = kpi_name if exists else None
        else:
            kra_name = values.get("kra_name")
            exists = bool(kra_name and frappe.db.exists("KRA Master", kra_name))
            name = kra_name if exists else None

        parsed_rows.append(
            {
                "row": idx,
                "action": "Update" if exists else "Create",
                "status": "Invalid" if errors else "Valid",
                "message": "; ".join(errors) if errors else "",
                "errors": errors,
                "exists": exists,
                "name": name,
                **values,
            }
        )

    return parsed_rows


def _normalize_header(value):
    return frappe.scrub(cstr(value or "")).replace("__", "_")


def _map_header_fields(headers, header_map):
    field_by_index = {}
    for idx, header in enumerate(headers):
        for field, aliases in header_map.items():
            if header in {frappe.scrub(a).replace("__", "_") for a in aliases}:
                field_by_index[idx] = field
                break
    return field_by_index


def _coerce_value(field, value):
    if value is None:
        return None
    if isinstance(value, str) and not value.strip():
        return None
    if field in {"start_date", "end_date"}:
        if isinstance(value, (datetime.datetime, datetime.date)):
            return value
        return getdate(value)
    if field == "weightage":
        return flt(value)
    return cstr(value).strip()


def _validate_import_row(values, required_fields, doctype, context=None):
    errors = []
    
    # Trim all string inputs
    for k, v in values.items():
        if isinstance(v, str):
            values[k] = v.strip()

    context = context or {}
    expected_owner_type = context.get("expected_owner_type")
    default_department = context.get("default_department")
    default_owner_type = context.get("default_owner_type")
    default_employee = context.get("default_employee")

    if default_department and not values.get("department"):
        values["department"] = default_department
    if default_department and values.get("department") and values.get("department") != default_department:
        errors.append("Department does not match selected filter")
    if default_employee and not values.get("employee"):
        values["employee"] = default_employee
    if default_employee and values.get("employee") and values.get("employee") != default_employee:
        errors.append("Employee does not match selected filter")

    for field in required_fields:
        if not values.get(field):
            errors.append(f"{field.replace('_', ' ').title()} is required")

    owner_type = values.get("owner_type")
    if expected_owner_type:
        if not owner_type and default_owner_type:
            values["owner_type"] = default_owner_type
            owner_type = default_owner_type
        if not owner_type:
            errors.append("Owner Type is required")
        elif owner_type.strip().lower() != expected_owner_type.lower():
            errors.append(f"Owner Type must be {expected_owner_type}")

    status_label = values.get("status_label")
    if status_label:
        cleaned = status_label.strip().title()
        if cleaned not in ALLOWED_GOAL_STATUS:
            errors.append("Status must be Draft, Active, Completed, or Archived")
        values["status_label"] = cleaned

    if doctype == "Goal Master":
        kpa_value = values.get("kpa")
        if kpa_value:
            kpa_name = frappe.db.get_value("KPA Master", {"kpa_name": kpa_value}, "name")
            if not kpa_name and not frappe.db.exists("KPA Master", kpa_value):
                errors.append("KPA not found")
            else:
                values["kpa"] = kpa_name or kpa_value

        if expected_owner_type == "Department":
            if not values.get("department"):
                errors.append("Department is required")
            parent_goal = values.get("parent_goal")
            if not parent_goal:
                errors.append("Parent Goal is required")
            elif not frappe.db.exists("Goal Master", parent_goal):
                parent_name = frappe.db.get_value("Goal Master", {"goal_name": parent_goal}, "name")
                if parent_name:
                    values["parent_goal"] = parent_name
                    parent_goal = parent_name
                else:
                    errors.append("Parent Goal not found")
            
            # Re-check existence as it might have been resolved by name
            if parent_goal and frappe.db.exists("Goal Master", parent_goal):
                parent_owner = frappe.db.get_value("Goal Master", parent_goal, "owner_type")
                if parent_owner != "Company":
                    errors.append("Parent Goal must be a Company goal")

        if expected_owner_type == "Employee":
            if not values.get("employee"):
                errors.append("Employee is required")
            parent_goal = values.get("parent_goal")
            if not parent_goal:
                errors.append("Parent Goal is required")
            elif not frappe.db.exists("Goal Master", parent_goal):
                parent_name = frappe.db.get_value("Goal Master", {"goal_name": parent_goal}, "name")
                if parent_name:
                    values["parent_goal"] = parent_name
                    parent_goal = parent_name
                else:
                    errors.append("Parent Goal not found")
            
            # Re-check existence as it might have been resolved by name
            if parent_goal and frappe.db.exists("Goal Master", parent_goal):
                parent_owner = frappe.db.get_value("Goal Master", parent_goal, "owner_type")
                if parent_owner != "Department":
                    errors.append("Parent Goal must be a Department goal")
                parent_dept = frappe.db.get_value("Goal Master", parent_goal, "department")
                if parent_dept and values.get("department") and parent_dept != values.get("department"):
                    errors.append("Parent Goal Department does not match")
                if parent_dept and not values.get("department"):
                    values["department"] = parent_dept

    if doctype == "KRA Master" and expected_owner_type == "Department":
        goal = values.get("goal")
        if not goal:
            errors.append("Goal is required")
        elif not frappe.db.exists("Goal Master", goal):
            goal_name = frappe.db.get_value("Goal Master", {"goal_name": goal}, "name")
            if goal_name:
                values["goal"] = goal_name
                goal = goal_name
            else:
                errors.append("Goal not found")
        
        # Re-check existence as it might have been resolved by name
        if goal and frappe.db.exists("Goal Master", goal):
            goal_owner = frappe.db.get_value("Goal Master", goal, "owner_type")
            if goal_owner != "Department":
                errors.append("Goal must be a Department goal")
            goal_department = frappe.db.get_value("Goal Master", goal, "department")
            if goal_department and not values.get("department"):
                values["department"] = goal_department
            if goal_department and values.get("department") and goal_department != values.get("department"):
                errors.append("Goal Department does not match")
        if not values.get("department"):
            errors.append("Department is required")

    if doctype == "KRA Master" and expected_owner_type == "Employee":
        goal = values.get("goal")
        if not goal:
            errors.append("Goal is required")
        elif not frappe.db.exists("Goal Master", goal):
            goal_name = frappe.db.get_value("Goal Master", {"goal_name": goal}, "name")
            if goal_name:
                values["goal"] = goal_name
                goal = goal_name
            else:
                errors.append("Goal not found")
        
        # Re-check existence as it might have been resolved by name
        if goal and frappe.db.exists("Goal Master", goal):
            goal_owner = frappe.db.get_value("Goal Master", goal, "owner_type")
            if goal_owner != "Employee":
                errors.append("Goal must be an Employee goal")
            goal_employee = frappe.db.get_value("Goal Master", goal, "employee")
            if goal_employee and not values.get("employee"):
                values["employee"] = goal_employee
            if goal_employee and values.get("employee") and goal_employee != values.get("employee"):
                errors.append("Goal Employee does not match")
            goal_department = frappe.db.get_value("Goal Master", goal, "department")
            if goal_department and not values.get("department"):
                values["department"] = goal_department
        if not values.get("employee"):
            errors.append("Employee is required")

    if doctype == "KPI Master":
        employee = values.get("employee")
        if employee and not frappe.db.exists("Employee", employee):
            errors.append("Employee not found")
        
        kra = values.get("kra")
        if kra:
            if not frappe.db.exists("KRA Master", kra):
                kra_name = frappe.db.get_value("KRA Master", {"kra_name": kra}, "name")
                if kra_name:
                    values["kra"] = kra_name
                    kra = kra_name
                else:
                    errors.append("KRA not found")
            
            # Re-check existence as it might have been resolved by name
            if kra and frappe.db.exists("KRA Master", kra):
                kra_owner = frappe.db.get_value("KRA Master", kra, "owner_type")
                if kra_owner == "Employee":
                    kra_employee = frappe.db.get_value("KRA Master", kra, "employee")
                    if kra_employee and not employee:
                        values["employee"] = kra_employee
                        employee = kra_employee
                    if kra_employee and employee and kra_employee != employee:
                        errors.append("KRA Employee does not match")

    return errors


def _build_preview_response(rows, headers, field_map):
    total = len(rows)
    valid = len([r for r in rows if r.get("status") == "Valid"])
    invalid = total - valid

    preview_rows = []
    for row in rows[:200]:
        formatted = {}
        for header in headers:
            key = field_map.get(header)
            value = row.get(key)
            if isinstance(value, (datetime.datetime, datetime.date)):
                value = value.strftime("%Y-%m-%d")
            formatted[header] = value
        preview_rows.append(formatted)

    return {
        "headers": headers,
        "rows": preview_rows,
        "summary": {"total": total, "valid": valid, "invalid": invalid},
    }


def _build_export_response(data, filename, format):
    if format == "xlsx":
        build_xlsx_response(data, filename)
    else:
        frappe.throw("Only xlsx format is supported.")


def _get_kpa_name_map(kpa_names):
    if not kpa_names:
        return {}
    rows = frappe.get_all(
        "KPA Master",
        filters={"name": ["in", list(set(kpa_names))]},
        fields=["name", "kpa_name"],
    )
    return {row.name: row.kpa_name for row in rows}


def _apply_department_progress(goals, department):
    if not goals or not department:
        return

    dept_goal_names = [g.get("name") for g in goals if g.get("name")]
    if not dept_goal_names:
        return

    employee_goals = frappe.get_all(
        "Goal Master",
        filters={"owner_type": "Employee", "parent_goal": ["in", dept_goal_names]},
        fields=["name", "parent_goal"],
    )
    employee_goal_names = [g.name for g in employee_goals]
    if not employee_goal_names:
        return

    goal_parent = {g.name: g.parent_goal for g in employee_goals}

    employee_kras = frappe.get_all(
        "KRA Master",
        filters={"goal": ["in", employee_goal_names]},
        fields=["name", "parent_kra"],
    )
    kra_parent = {k.name: k.parent_kra for k in employee_kras if k.parent_kra}

    items = frappe.get_all(
        "Scorecard Item",
        filters={"goal": ["in", employee_goal_names]},
        fields=["goal", "kra", "score", "weightage"],
    )
    if not items:
        return

    goal_scores = {}
    kra_scores = {}
    for item in items:
        parent_goal = goal_parent.get(item.goal)
        if parent_goal:
            bucket = goal_scores.setdefault(parent_goal, {"sum": 0, "weight": 0})
            weight = item.weightage or 1
            bucket["sum"] += (item.score or 0) * weight
            bucket["weight"] += weight

        parent_kra = kra_parent.get(item.kra)
        if parent_kra:
            bucket = kra_scores.setdefault(parent_kra, {"sum": 0, "weight": 0})
            weight = item.weightage or 1
            bucket["sum"] += (item.score or 0) * weight
            bucket["weight"] += weight

    for goal in goals:
        goal_bucket = goal_scores.get(goal.get("name"))
        if goal_bucket and goal_bucket.get("weight"):
            goal["progress"] = goal_bucket["sum"] / goal_bucket["weight"]

        for kra in goal.get("kras", []):
            kra_bucket = kra_scores.get(kra.get("name"))
            if kra_bucket and kra_bucket.get("weight"):
                kra["progress"] = kra_bucket["sum"] / kra_bucket["weight"]
