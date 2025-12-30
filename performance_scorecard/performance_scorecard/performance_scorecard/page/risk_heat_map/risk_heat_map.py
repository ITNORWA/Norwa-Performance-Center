import frappe

@frappe.whitelist()
def get_risk_matrix_data():
    """
    Returns risk distribution for the 5x5 matrix.
    Format: { (likelihood, impact): [list of risks], ... }
    """
    risks = frappe.get_all("Risk Register", 
        filters={"status": ["!=", "Closed"]}, 
        fields=["name", "risk_title", "likelihood", "impact", "risk_score", "risk_level"]
    )
    
    matrix = {}
    
    # Initialize 5x5 grid
    for l in range(1, 6):
        for i in range(1, 6):
            matrix[f"{l}-{i}"] = []
            
    for risk in risks:
        if risk.likelihood and risk.impact:
            l_val = int(risk.likelihood.split(' - ')[0])
            i_val = int(risk.impact.split(' - ')[0])
            key = f"{l_val}-{i_val}"
            
            if key in matrix:
                matrix[key].append(risk)
                
    return matrix
