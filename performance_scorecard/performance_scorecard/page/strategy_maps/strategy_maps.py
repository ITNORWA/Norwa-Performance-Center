import frappe

@frappe.whitelist()
def get_strategy_map_data():
    # Fetch hierarchy: Company Goal -> Department Goal -> Individual Goal
    # Return a nested structure
    
    company_goals = frappe.get_all("Goal", filters={"owner_type": "Company", "status": "Active"}, fields=["name", "goal_name", "weightage"])
    
    data = []
    for cg in company_goals:
        node = {
            "name": cg.name,
            "label": cg.goal_name,
            "type": "Company",
            "children": []
        }
        
        # Fetch Department Goals linked to this Company Goal
        dept_goals = frappe.get_all("Goal", filters={"parent_goal": cg.name, "owner_type": "Department", "status": "Active"}, fields=["name", "goal_name", "department"])
        
        for dg in dept_goals:
            dept_node = {
                "name": dg.name,
                "label": dg.goal_name,
                "type": "Department",
                "department": dg.department,
                "children": []
            }
            
            # Fetch Individual Goals linked to this Department Goal
            ind_goals = frappe.get_all("Goal", filters={"parent_goal": dg.name, "owner_type": "Employee", "status": "Active"}, fields=["name", "goal_name", "employee"])
            
            for ig in ind_goals:
                ind_node = {
                    "name": ig.name,
                    "label": ig.goal_name,
                    "type": "Individual",
                    "employee": ig.employee
                }
                dept_node["children"].append(ind_node)
                
            node["children"].append(dept_node)
            
        data.append(node)
        
    return data
